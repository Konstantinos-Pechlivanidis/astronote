#!/usr/bin/env python3
"""Script to flatten nested retail monorepo structure."""
import shutil
import os
import sys

def move_api_contents():
    """Move apps/retail-api/apps/api contents to apps/retail-api."""
    api_src = 'apps/retail-api/apps/api/src'
    api_scripts = 'apps/retail-api/apps/api/scripts'
    
    if os.path.exists(api_src):
        dst_src = 'apps/retail-api/src'
        if not os.path.exists(dst_src):
            os.makedirs(dst_src, exist_ok=True)
            shutil.move(api_src, dst_src)
            print(f'✓ Moved {api_src} -> {dst_src}')
        else:
            # Merge contents
            for item in os.listdir(api_src):
                src_item = os.path.join(api_src, item)
                dst_item = os.path.join(dst_src, item)
                if os.path.exists(dst_item):
                    print(f'  ⚠ Skipping {item} (already exists)')
                else:
                    shutil.move(src_item, dst_item)
                    print(f'  ✓ Moved {item}')
    
    if os.path.exists(api_scripts):
        dst_scripts = 'apps/retail-api/scripts'
        if not os.path.exists(dst_scripts):
            os.makedirs(dst_scripts, exist_ok=True)
            shutil.move(api_scripts, dst_scripts)
            print(f'✓ Moved {api_scripts} -> {dst_scripts}')
        else:
            # Merge contents
            for item in os.listdir(api_scripts):
                src_item = os.path.join(api_scripts, item)
                dst_item = os.path.join(dst_scripts, item)
                if os.path.exists(dst_item):
                    print(f'  ⚠ Skipping {item} (already exists)')
                else:
                    shutil.move(src_item, dst_item)
                    print(f'  ✓ Moved {item}')

def move_worker():
    """Move apps/retail-api/apps/worker to apps/retail-worker."""
    worker_src = 'apps/retail-api/apps/worker'
    if os.path.exists(worker_src):
        if not os.path.exists('apps/retail-worker'):
            shutil.move(worker_src, 'apps/retail-worker')
            print(f'✓ Moved {worker_src} -> apps/retail-worker')
        else:
            print('⚠ apps/retail-worker already exists')
    else:
        print(f'⚠ {worker_src} not found')

def move_web():
    """Move apps/retail-api/apps/web to apps/retail-web-legacy."""
    web_src = 'apps/retail-api/apps/web'
    if os.path.exists(web_src):
        if not os.path.exists('apps/retail-web-legacy'):
            shutil.move(web_src, 'apps/retail-web-legacy')
            print(f'✓ Moved {web_src} -> apps/retail-web-legacy')
        else:
            print('⚠ apps/retail-web-legacy already exists')
    else:
        print(f'⚠ {web_src} not found')

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    print('Flattening nested retail monorepo...')
    print()
    move_api_contents()
    print()
    move_worker()
    print()
    move_web()
    print()
    print('✓ Flattening complete!')

