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
):
    """
    Composite a transparent PNG logo onto a post image.

    Args:
        post_path: Path to the post image (will be overwritten).
        logo_path: Path to the logo PNG (RGBA with transparency).
        position: One of 'top-left', 'top-center', 'top-right'.
        max_logo_width: Logo width as a fraction of post width (0.0-1.0).
        padding: Pixels from edge.
        background_block: Optional hex color for a rectangle behind the logo.
        bg_padding: Extra padding around logo inside the background block.
        bg_radius: Corner radius for the background block.
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
    else:
        print(
            f"  ERROR: Unknown position '{position}'. Use top-left, top-center, top-right, "
            "bottom-left, bottom-center, bottom-right, or center."
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
        ],
    )
    parser.add_argument("--max-logo-width", type=float, default=0.30)
    parser.add_argument("--padding", type=int, default=40)
    parser.add_argument("--background-block", default=None, help="Hex color for background behind logo")
    args = parser.parse_args()

    success = overlay_logo(
        post_path=args.post_path,
        logo_path=args.logo_path,
        position=args.position,
        max_logo_width=args.max_logo_width,
        padding=args.padding,
        background_block=args.background_block,
    )
    sys.exit(0 if success else 1)
