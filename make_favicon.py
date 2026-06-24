from PIL import Image

try:
    im = Image.open("client/public/logo.png")
    w, h = im.size
    # Crop a square from the left side
    icon = im.crop((0, 0, h, h))
    
    # Save as ICO and PNG
    icon.save("client/public/favicon.ico", format="ICO", sizes=[(32, 32), (64, 64)])
    icon.save("client/public/favicon.png")
    print("Favicon created successfully.")
except Exception as e:
    print(f"Error: {e}")
