import urllib.request
import re

url = 'https://www.svgrepo.com/svg/226154/saxophone'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    match = re.search(r'href="(.*?download.*?\.svg)"', html)
    if match:
        download_url = 'https://www.svgrepo.com' + match.group(1)
        print('Downloading from:', download_url)
        svg_content = urllib.request.urlopen(urllib.request.Request(download_url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8')
        with open('sax.svg', 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print('Saved to sax.svg')
    else:
        print('Could not find download link')
except Exception as e:
    print('Error:', e)
