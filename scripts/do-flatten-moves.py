#!/usr/bin/env python3
"""Perform Phase A retail monorepo flattening moves."""
import shutil
import os
import sys

def main():
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    print("Phase A: Flattening retail monorepo...")
    print()
    
    # 1. Move API src
    api_src = 'apps/retail-api/apps/api/src'
    dst_src = 'apps/retail-api/src'
    if os.path.exists(api_src):
        if not os.path.exists(dst_src):
            shutil.move(api_src, dst_src)
            print(f"✓ Moved {api_src} -> {dst_src}")
        else:
            print(f"⚠ {dst_src} already exists, merging...")
            for item in os.listdir(api_src):
                src_item = os.path.join(api_src, item)
                dst_item = os.path.join(dst_src, item)
                if os.path.exists(dst_item):
                    print(f"  ⚠ Skipping {item} (already exists)")
                else:
                    shutil.move(src_item, dst_item)
                    print(f"  ✓ Moved {item}")
    
    # 2. Merge API scripts
    api_scripts = 'apps/retail-api/apps/api/scripts'
    dst_scripts = 'apps/retail-api/scripts'
    if os.path.exists(api_scripts):
        if not os.path.exists(dst_scripts):
            os.makedirs(dst_scripts, exist_ok=True)
        for item in os.listdir(api_scripts):
            src_item = os.path.join(api_scripts, item)
            dst_item = os.path.join(dst_scripts, item)
            if os.path.exists(dst_item):
                print(f"  ⚠ Skipping script {item} (already exists)")
            else:
                shutil.move(src_item, dst_item)
                print(f"  ✓ Moved script {item}")
        try:
            os.rmdir(api_scripts)
        except:
            pass
    
    # 3. Move worker
    worker_src = 'apps/retail-api/apps/worker'
    if os.path.exists(worker_src):
        if not os.path.exists('apps/retail-worker'):
            shutil.move(worker_src, 'apps/retail-worker')
            print(f"✓ Moved {worker_src} -> apps/retail-worker")
        else:
            print("⚠ apps/retail-worker already exists")
    
    # 4. Move web
    web_src = 'apps/retail-api/apps/web'
    if os.path.exists(web_src):
        if not os.path.exists('apps/retail-web-legacy'):
            shutil.move(web_src, 'apps/retail-web-legacy')
            print(f"✓ Moved {web_src} -> apps/retail-web-legacy")
        else:
            print("⚠ apps/retail-web-legacy already exists")
    
    # 5. Clean up empty directories
    try:
        if os.path.exists('apps/retail-api/apps/api'):
            os.rmdir('apps/retail-api/apps/api')
        if os.path.exists('apps/retail-api/apps'):
            os.rmdir('apps/retail-api/apps')
    except:
        pass
    
    print()
    print("✓ Moves complete!")

if __name__ == '__main__':
    main()

