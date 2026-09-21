"""Generate an .ico file for the Starlink Monitor application."""
from PIL import Image, ImageDraw


def create_icon():
    """Create a tray icon with SL initials."""
    size = 256
    img = Image.new("RGBA", (size, size), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw background circle
    draw.ellipse([2, 2, size - 2, size - 2], fill=(30, 144, 255), outline=(255, 255, 255), width=3)

    # Draw text "SL" for Starlink
    # Using default font at a reasonable size
    font_size = size // 3
    draw.text(
        (size // 2, size // 2),
        "SL",
        fill=(255, 255, 255),
        anchor="mm",
    )

    # Save as .ico file
    img.save("icon.ico")
    print("Generated icon.ico")


if __name__ == "__main__":
    create_icon()
