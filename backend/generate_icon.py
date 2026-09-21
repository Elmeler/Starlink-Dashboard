"""Convert SL-Dash.png to icon.ico for the application."""
from PIL import Image
import os

def create_icon_from_image():
    """Convert the SL-Dash.png image to icon.ico."""
    source_image = os.path.join("..", "SL-Dash.png")
    output_icon = "icon.ico"

    if not os.path.exists(source_image):
        print(f"Error: {source_image} not found")
        return False

    try:
        # Open the image
        img = Image.open(source_image)
        print(f"Loaded image: {img.size} {img.mode}")

        # Convert to RGBA if necessary
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Create multiple sizes for the ico file (standard Windows icon sizes)
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

        # Resize and save
        resized_images = []
        for size in sizes:
            resized = img.resize(size, Image.Resampling.LANCZOS)
            resized_images.append(resized)

        # Save as .ico with all sizes
        img.save(
            output_icon,
            format="ICO",
            sizes=sizes
        )

        print(f"Successfully created {output_icon}")
        print(f"Icon sizes: {sizes}")
        return True

    except Exception as e:
        print(f"Error converting image: {e}")
        return False

if __name__ == "__main__":
    if create_icon_from_image():
        print("Icon generation complete!")
    else:
        print("Icon generation failed!")
