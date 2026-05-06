"""
Universal Logo Overlay Script
Composites a transparent PNG logo onto a post image at a specified position.
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Pillow is required. Install with: pip install Pillow")
    sys.exit(1)


def overlay_logo(
    post_path: str,
    logo_path: str,
    position: str = "top-left",
    max_logo_width: float = 0.30,
    padding: int = 40,
    background_block: str = None,
    bg_padding: int = 12,
    bg_radius: int = 10,
    clean_band: str = None,
    clean_band_height: int = None,
    force_clean_band: bool = False,
    x_pct: float = None,
    y_pct: float = None,
):
    """
    Composite a transparent PNG logo onto a post image.

    Args:
        post_path: Path to the post image (will be overwritten).
        logo_path: Path to the logo PNG (RGBA with transparency).
        position: One of the 7 named positions, or 'custom' to use x_pct/y_pct.
        max_logo_width: Logo width as a fraction of post width (0.0-1.0).
        padding: Pixels from edge (ignored when position='custom').
        background_block: Optional hex color for a rectangle behind the logo.
        bg_padding: Extra padding around logo inside the background block.
        bg_radius: Corner radius for the background block.
        x_pct: For position='custom', logo top-left x as fraction of post width.
        y_pct: For position='custom', logo top-left y as fraction of post height.
    """
    post_path = Path(post_path)
    logo_path = Path(logo_path)

    if not post_path.exists():
        print(f"  ERROR: Post not found: {post_path}")
        return False
    if not logo_path.exists():
        print(f"  ERROR: Logo not found: {logo_path}")
        return False

    # Open post — ensure RGBA
    post = Image.open(post_path).convert("RGBA")
    post_w, post_h = post.size

    # Open logo — ensure RGBA
    logo = Image.open(logo_path).convert("RGBA")
    logo_w, logo_h = logo.size

    # Scale logo
    target_w = int(post_w * max_logo_width)
    scale = target_w / logo_w
    target_h = int(logo_h * scale)
    logo = logo.resize((target_w, target_h), Image.LANCZOS)

    # Clean band: paint a solid full-width stripe over the logo zone BEFORE
    # compositing. This erases any AI-generated ghost logo nanobanana may have
    # drawn despite the negative prompt — which is the usual cause of "wavy"
    # or "blurry" looking logos in the final post.
    #
    # Footgun guard: if the band zone already contains real design content,
    # painting over it leaves a visible seam and clips the design. Refuse and
    # require the caller to regen with a reserved margin instead.
    if clean_band:
        band_rgba = parse_hex_color(clean_band)
        band_color = (band_rgba[0], band_rgba[1], band_rgba[2], 255)
        band_h = clean_band_height if clean_band_height else (target_h + padding * 2)
        if "top" in position:
            band_y0 = 0
            band_y1 = band_h
        elif "bottom" in position:
            band_y0 = post_h - band_h
            band_y1 = post_h
        else:  # center
            band_y0 = (post_h - band_h) // 2
            band_y1 = band_y0 + band_h

        if not force_clean_band:
            ok, reason = _band_zone_is_safe_to_overpaint(
                post, band_y0, band_y1, band_color
            )
            if not ok:
                print(
                    f"  BLOCKED: --clean-band would clip design content. {reason}\n"
                    f"  Fix: regen with the {position.split('-')[0]} {band_h}px reserved "
                    f"as solid {clean_band} (no text, no logo, no graphic), then re-run "
                    f"WITHOUT --clean-band. Override only if you know what you're doing: "
                    f"--force-clean-band.",
                    file=sys.stderr,
                )
                return False

        band_layer = Image.new("RGBA", post.size, (0, 0, 0, 0))
        ImageDraw.Draw(band_layer).rectangle(
            [0, band_y0, post_w, band_y1], fill=band_color
        )
        post = Image.alpha_composite(post, band_layer)

    # Calculate position
    if position == "top-left":
        x = padding
        y = padding
    elif position == "top-center":
        x = (post_w - target_w) // 2
        y = padding
    elif position == "top-right":
        x = post_w - target_w - padding
        y = padding
    elif position == "bottom-left":
        x = padding
        y = post_h - target_h - padding
    elif position == "bottom-center":
        x = (post_w - target_w) // 2
        y = post_h - target_h - padding
    elif position == "bottom-right":
        x = post_w - target_w - padding
        y = post_h - target_h - padding
    elif position == "center":
        x = (post_w - target_w) // 2
        y = (post_h - target_h) // 2
    elif position == "custom":
        # Drag-anywhere mode from the dashboard's logo overlay panel.
        # x_pct/y_pct are fractions of post width/height; clamp into the
        # image so a slightly out-of-bounds drop doesn't render off-canvas.
        if x_pct is None or y_pct is None:
            print("  ERROR: position='custom' requires --x-pct and --y-pct")
            return False
        max_x = max(0, post_w - target_w)
        max_y = max(0, post_h - target_h)
        x = max(0, min(int(post_w * x_pct), max_x))
        y = max(0, min(int(post_h * y_pct), max_y))
    else:
        print(
            f"  ERROR: Unknown position '{position}'. Use top-left, top-center, top-right, "
            "bottom-left, bottom-center, bottom-right, center, or custom."
        )
        return False

    # Draw background block if requested
    if background_block:
        color = parse_hex_color(background_block)
        # Create an overlay for the background block
        bg_layer = Image.new("RGBA", post.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(bg_layer)
        bx0 = x - bg_padding
        by0 = y - bg_padding
        bx1 = x + target_w + bg_padding
        by1 = y + target_h + bg_padding
        draw.rounded_rectangle(
            [bx0, by0, bx1, by1],
            radius=bg_radius,
            fill=color,
        )
        post = Image.alpha_composite(post, bg_layer)

    # Paste logo using its own alpha as mask
    # Create a transparent layer, paste logo onto it, then composite
    logo_layer = Image.new("RGBA", post.size, (0, 0, 0, 0))
    logo_layer.paste(logo, (x, y), logo)
    result = Image.alpha_composite(post, logo_layer)

    # Save as PNG (preserve quality, no JPEG artifacts)
    result.save(post_path, "PNG")
    return True


def _band_zone_is_safe_to_overpaint(post, y0: int, y1: int, expected_rgba):
    """
    Return (True, "") if the band zone is uniform enough to safely overpaint —
    i.e. the AI render already reserved this strip as a solid margin.
    Return (False, reason) if the zone contains real design content that would
    be clipped.

    Heuristic: crop the band, downsample to keep this fast, then check
      1. mean color is close to the requested clean-band color (delta < 24/ch), AND
      2. per-channel stddev is low (< 8) — i.e. truly flat fill.
    """
    try:
        from PIL import ImageStat
    except Exception as e:  # pragma: no cover
        return True, ""  # fail-open if Pillow stats unavailable

    crop = post.crop((0, y0, post.size[0], y1)).convert("RGB")
    # Downsample to ~256px wide for speed; preserves color distribution.
    if crop.size[0] > 256:
        ratio = 256 / crop.size[0]
        crop = crop.resize(
            (256, max(1, int(crop.size[1] * ratio))), Image.BILINEAR
        )

    stat = ImageStat.Stat(crop)
    mean = stat.mean[:3]
    stddev = stat.stddev[:3]

    color_delta = max(abs(mean[i] - expected_rgba[i]) for i in range(3))
    max_stddev = max(stddev)

    if max_stddev > 8.0:
        return (
            False,
            f"band zone is not flat (stddev={max_stddev:.1f}, threshold 8.0) — "
            f"design content detected.",
        )
    if color_delta > 24.0:
        return (
            False,
            f"band zone color {tuple(round(m) for m in mean)} does not match "
            f"requested {expected_rgba[:3]} (delta={color_delta:.1f}, threshold 24).",
        )
    return True, ""


def parse_hex_color(hex_str: str):
    """Parse a hex color string like '#005181' into an RGBA tuple."""
    hex_str = hex_str.lstrip("#")
    if len(hex_str) == 6:
        r, g, b = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16)
        return (r, g, b, 220)  # Slightly translucent for a polished look
    elif len(hex_str) == 8:
        r, g, b, a = int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16), int(hex_str[6:8], 16)
        return (r, g, b, a)
    else:
        return (0, 0, 0, 220)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Overlay a logo onto a post image.")
    parser.add_argument("post_path", help="Path to the post image")
    parser.add_argument("logo_path", help="Path to the logo PNG")
    parser.add_argument(
        "--position",
        default="top-left",
        choices=[
            "top-left",
            "top-center",
            "top-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
            "center",
            "custom",
        ],
    )
    parser.add_argument(
        "--x-pct",
        type=float,
        default=None,
        help="For --position custom: logo top-left x as fraction of post width (0.0-1.0).",
    )
    parser.add_argument(
        "--y-pct",
        type=float,
        default=None,
        help="For --position custom: logo top-left y as fraction of post height (0.0-1.0).",
    )
    parser.add_argument("--max-logo-width", type=float, default=0.30)
    parser.add_argument("--padding", type=int, default=40)
    parser.add_argument("--background-block", default=None, help="Hex color for background behind logo")
    parser.add_argument(
        "--clean-band",
        default=None,
        help="Hex color for a full-width opaque stripe painted over the logo zone before "
             "compositing. Use this to kill AI-generated ghost logos. e.g. --clean-band #FFFFFF",
    )
    parser.add_argument(
        "--clean-band-height",
        type=int,
        default=None,
        help="Override the auto-calculated band height (px). Default = logo height + padding*2.",
    )
    parser.add_argument(
        "--force-clean-band",
        action="store_true",
        help="Bypass the safety check that refuses --clean-band when design content is "
             "detected in the band zone. Use only when you accept the seam/clip.",
    )
    args = parser.parse_args()

    success = overlay_logo(
        post_path=args.post_path,
        logo_path=args.logo_path,
        position=args.position,
        max_logo_width=args.max_logo_width,
        padding=args.padding,
        background_block=args.background_block,
        clean_band=args.clean_band,
        clean_band_height=args.clean_band_height,
        force_clean_band=args.force_clean_band,
        x_pct=args.x_pct,
        y_pct=args.y_pct,
    )
    sys.exit(0 if success else 1)
