#!/usr/bin/env python3
"""
生成图标文件脚本
需要安装Pillow库: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, output_path):
    """创建图标"""
    # 创建图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制背景
    margin = size // 10
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=size // 8,
        fill=(78, 205, 196, 255)  # #4ecdc4
    )
    
    # 绘制攀爬架结构
    white = (255, 255, 255, 255)
    red = (255, 107, 107, 255)  # #ff6b6b
    
    # 计算比例
    scale = size / 100
    
    # 左侧立柱
    x1, y1 = int(20 * scale), int(20 * scale)
    x2, y2 = int(28 * scale), int(80 * scale)
    draw.rectangle([x1, y1, x2, y2], fill=white)
    
    # 右侧立柱
    x1, y1 = int(72 * scale), int(20 * scale)
    x2, y2 = int(80 * scale), int(80 * scale)
    draw.rectangle([x1, y1, x2, y2], fill=white)
    
    # 顶部横梁
    x1, y1 = int(20 * scale), int(20 * scale)
    x2, y2 = int(80 * scale), int(28 * scale)
    draw.rectangle([x1, y1, x2, y2], fill=white)
    
    # 中间横梁
    x1, y1 = int(20 * scale), int(50 * scale)
    x2, y2 = int(80 * scale), int(58 * scale)
    draw.rectangle([x1, y1, x2, y2], fill=white)
    
    # 斜撑
    draw.line(
        [(int(28 * scale), int(28 * scale)), (int(72 * scale), int(50 * scale))],
        fill=white, width=int(4 * scale)
    )
    draw.line(
        [(int(72 * scale), int(28 * scale)), (int(28 * scale), int(50 * scale))],
        fill=white, width=int(4 * scale)
    )
    
    # 连接点
    points = [
        (24, 24), (76, 24),
        (24, 54), (76, 54),
        (24, 76), (76, 76)
    ]
    
    for px, py in points:
        x, y = int(px * scale), int(py * scale)
        r = int(4 * scale)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=red)
    
    # 保存图像
    img.save(output_path, 'PNG')
    print(f"Created icon: {output_path}")

def create_ico(sizes, output_path):
    """创建ICO文件"""
    images = []
    
    for size in sizes:
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # 绘制背景
        margin = size // 10
        draw.rounded_rectangle(
            [margin, margin, size - margin, size - margin],
            radius=size // 8,
            fill=(78, 205, 196, 255)
        )
        
        # 绘制简化的攀爬架
        white = (255, 255, 255, 255)
        red = (255, 107, 107, 255)
        
        scale = size / 100
        
        # 左侧立柱
        draw.rectangle(
            [int(20 * scale), int(20 * scale), int(28 * scale), int(80 * scale)],
            fill=white
        )
        
        # 右侧立柱
        draw.rectangle(
            [int(72 * scale), int(20 * scale), int(80 * scale), int(80 * scale)],
            fill=white
        )
        
        # 顶部横梁
        draw.rectangle(
            [int(20 * scale), int(20 * scale), int(80 * scale), int(28 * scale)],
            fill=white
        )
        
        # 中间横梁
        draw.rectangle(
            [int(20 * scale), int(50 * scale), int(80 * scale), int(58 * scale)],
            fill=white
        )
        
        # 连接点
        points = [(24, 24), (76, 24), (24, 54), (76, 54)]
        for px, py in points:
            x, y = int(px * scale), int(py * scale)
            r = int(3 * scale)
            draw.ellipse([x - r, y - r, x + r, y + r], fill=red)
        
        images.append(img)
    
    # 保存ICO文件
    images[0].save(
        output_path,
        format='ICO',
        sizes=[(img.size[0], img.size[1]) for img in images],
        append_images=images[1:]
    )
    print(f"Created ICO: {output_path}")

def main():
    # 图标目录
    icon_dir = "src-tauri/icons"
    
    # 创建不同尺寸的PNG图标
    sizes = [32, 128, 256]
    for size in sizes:
        output_path = os.path.join(icon_dir, f"{size}x{size}.png")
        create_icon(size, output_path)
    
    # 创建2倍尺寸图标
    create_icon(256, os.path.join(icon_dir, "128x128@2x.png"))
    
    # 创建ICO文件
    create_ico([16, 32, 48, 64], os.path.join(icon_dir, "icon.ico"))
    
    print("All icons created successfully!")

if __name__ == "__main__":
    main()
