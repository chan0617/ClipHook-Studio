import subprocess
import sys

def install(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])

for pkg in ["gradio", "pillow", "opencv-python", "numpy", "scipy"]:
    try:
        __import__(pkg.replace("-", "_").replace("opencv_python", "cv2"))
    except ImportError:
        install(pkg)

import os
import io
import zipfile
import traceback

import cv2
import gradio as gr
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes

OUTPUT_DIR = "./output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────
# STEP 1  Black-background removal
# ─────────────────────────────────────────────
def remove_black_background(img: Image.Image) -> Image.Image:
    """Convert to RGBA and zero-out pixels where R<30 & G<30 & B<30."""
    img = img.convert("RGBA")
    arr = np.array(img, dtype=np.uint8)

    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    black_mask = (r < 30) & (g < 30) & (b < 30)

    # Feather 1px: erode mask by 1px so edges don't get hard-cut
    kernel = np.ones((3, 3), np.uint8)
    black_eroded = cv2.erode(black_mask.astype(np.uint8), kernel, iterations=1).astype(bool)
    feather_zone = black_mask & ~black_eroded          # 1-px border ring

    arr[:, :, 3][black_eroded] = 0
    # Blend feather zone: keep partial transparency
    arr[:, :, 3][feather_zone] = (arr[:, :, 3][feather_zone] * 0.5).astype(np.uint8)

    return Image.fromarray(arr, "RGBA")


def needs_black_removal(img: Image.Image) -> bool:
    """Return True if image is RGB or has significant black pixels in alpha."""
    if img.mode != "RGBA":
        return True
    arr = np.array(img)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    # Pixels that look black AND are opaque → black bg present
    black_opaque = (r < 30) & (g < 30) & (b < 30) & (a > 200)
    ratio = black_opaque.sum() / max(arr.shape[0] * arr.shape[1], 1)
    return ratio > 0.01   # >1% black opaque pixels → treat as black bg


# ─────────────────────────────────────────────
# STEP 2  Alpha edge cleanup
# ─────────────────────────────────────────────
def clean_alpha_edges(img: Image.Image) -> Image.Image:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    alpha = arr[:, :, 3]

    # Morphological closing to fill tiny holes
    kernel = np.ones((3, 3), np.uint8)
    alpha_closed = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)

    # Hard threshold
    alpha_hard = np.where(alpha_closed > 128, 255, 0).astype(np.uint8)
    arr[:, :, 3] = alpha_hard
    return Image.fromarray(arr, "RGBA")


# ─────────────────────────────────────────────
# STEP 3  White outline (NO black anywhere)
# ─────────────────────────────────────────────
def add_white_outline(img: Image.Image, outline_px: int = 8) -> Image.Image:
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    alpha = arr[:, :, 3]

    # Elliptical dilation kernel
    ksize = outline_px * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ksize, ksize))
    dilated = cv2.dilate(alpha, kernel, iterations=1)

    outline_mask = (dilated > 0) & (alpha == 0)   # zone outside original

    # Build white outline layer (same size, fully transparent base)
    h, w = arr.shape[:2]
    outline_layer = np.zeros((h, w, 4), dtype=np.uint8)
    outline_layer[outline_mask] = [255, 255, 255, 255]

    # Composite: outline below, original on top
    result = outline_layer.copy()
    fg_mask = alpha > 0
    result[fg_mask] = arr[fg_mask]

    return Image.fromarray(result, "RGBA")


# ─────────────────────────────────────────────
# STEP 4  4K upscale + unsharp mask
# ─────────────────────────────────────────────
def upscale_4k(img: Image.Image) -> Image.Image:
    TARGET = 3840
    w, h = img.size
    scale = TARGET / max(w, h)
    new_w, new_h = int(w * scale), int(h * scale)

    arr = np.array(img)
    upscaled = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    # Unsharp mask on RGB channels only (preserve alpha)
    rgb = upscaled[:, :, :3].astype(np.float32)
    blurred = cv2.GaussianBlur(rgb, (0, 0), sigmaX=0.8)
    sharpened = cv2.addWeighted(rgb, 1.0 + 1.3, blurred, -1.3, 0)
    sharpened = np.clip(sharpened, 0, 255).astype(np.uint8)

    upscaled[:, :, :3] = sharpened
    return Image.fromarray(upscaled, "RGBA")


# ─────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────
def process_single(pil_img: Image.Image, filename: str) -> tuple[Image.Image | None, str]:
    try:
        # Step 1
        if needs_black_removal(pil_img):
            pil_img = remove_black_background(pil_img)
        else:
            pil_img = pil_img.convert("RGBA")

        # Step 2
        pil_img = clean_alpha_edges(pil_img)

        # Step 3
        pil_img = add_white_outline(pil_img, outline_px=8)

        # Step 4
        pil_img = upscale_4k(pil_img)

        # Save
        base = os.path.splitext(os.path.basename(filename))[0]
        out_path = os.path.join(OUTPUT_DIR, f"{base}_sticker.png")
        pil_img.save(out_path, "PNG")

        return pil_img, f"✅ {filename} → {out_path}"

    except Exception:
        return None, f"❌ {filename} failed:\n{traceback.format_exc()}"


def process_batch(files):
    if not files:
        return [], "No files uploaded.", None

    results_imgs = []
    log_lines = []
    saved_paths = []

    for f in files:
        path = f.name if hasattr(f, "name") else str(f)
        filename = os.path.basename(path)
        try:
            pil_img = Image.open(path)
            out_img, msg = process_single(pil_img, filename)
            log_lines.append(msg)
            if out_img is not None:
                results_imgs.append(out_img)
                base = os.path.splitext(filename)[0]
                saved_paths.append(os.path.join(OUTPUT_DIR, f"{base}_sticker.png"))
        except Exception:
            log_lines.append(f"❌ {filename} failed:\n{traceback.format_exc()}")

    # Build ZIP
    zip_path = None
    if saved_paths:
        zip_path = os.path.join(OUTPUT_DIR, "stickers_all.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            for p in saved_paths:
                zf.write(p, os.path.basename(p))

    log_text = "\n".join(log_lines)
    return results_imgs, log_text, zip_path


# ─────────────────────────────────────────────
# Gradio UI
# ─────────────────────────────────────────────
css = """
#gallery { max-height: 600px; overflow-y: auto; }
.log-box textarea { font-family: monospace; font-size: 12px; }
"""

with gr.Blocks(title="Sticker Processor", css=css) as demo:
    gr.Markdown(
        """
        # 🎨 Sticker Processor
        **Black BG removal → Alpha cleanup → White outline (8px) → 4K upscale**
        Upload PNG / JPG files (batch supported).
        """
    )

    with gr.Row():
        upload = gr.File(
            label="Upload images (PNG / JPG)",
            file_count="multiple",
            file_types=[".png", ".jpg", ".jpeg"],
        )

    run_btn = gr.Button("▶ Process", variant="primary")

    with gr.Row():
        gallery = gr.Gallery(
            label="Results",
            elem_id="gallery",
            columns=3,
            object_fit="contain",
            height=550,
        )

    with gr.Row():
        log_box = gr.Textbox(
            label="Log",
            lines=8,
            interactive=False,
            elem_classes=["log-box"],
        )

    with gr.Row():
        dl_zip = gr.File(label="⬇ Download All (ZIP)", interactive=False)

    run_btn.click(
        fn=process_batch,
        inputs=[upload],
        outputs=[gallery, log_box, dl_zip],
    )

if __name__ == "__main__":
    demo.launch(share=False)
