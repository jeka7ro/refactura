from PIL import Image

img = Image.open("/Users/eugeniucazmal/Downloads/dev_office/smart invoice/invoice_images/image_0_0.jpeg")

# The image is 2480x3508
# Crop the top portion. Let's say top 550 pixels (about 15% of the height)
# (left, upper, right, lower)
header_box = (0, 0, 2480, 600)
header_img = img.crop(header_box)

header_img.save("/Users/eugeniucazmal/Downloads/dev_office/smart invoice/invoice_images/header.jpeg")
print("Cropped header saved.")
