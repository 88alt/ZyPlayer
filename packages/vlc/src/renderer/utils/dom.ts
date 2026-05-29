const isMobile = /mobile/i.test(window.navigator.userAgent);

export function query(selector: string, parent: ParentNode = document) {
  return parent.querySelector(selector);
}

export function queryAll(selector: string, parent: ParentNode = document) {
  return Array.from(parent.querySelectorAll(selector));
}

export function addClass(target: Element, className: string) {
  return target.classList.add(className);
}

export function removeClass(target: Element, className: string) {
  return target.classList.remove(className);
}

export function hasClass(target: Element, className: string) {
  return target.classList.contains(className);
}

export function append(parent: Element, child: Element | string) {
  if (child instanceof Element) {
    parent.appendChild(child);
  } else {
    parent.insertAdjacentHTML('beforeend', String(child));
  }
  return parent.lastElementChild || parent.lastChild;
}

export function remove(child: Element) {
  return child.parentNode!.removeChild(child);
}

export function setStyle(element: HTMLElement, key: string, value: string) {
  element.style[key as any] = value;
  return element;
}

export function setStyles(element: HTMLElement, styles: Record<string, string>) {
  for (const key in styles) {
    setStyle(element, key, styles[key]);
  }
  return element;
}

export function getStyle(element: HTMLElement, key: string, numberType = true) {
  const value = window.getComputedStyle(element, null).getPropertyValue(key);
  return numberType ? Number.parseFloat(value) : value;
}

export function siblings(target: Element) {
  return Array.from(target.parentElement!.children).filter((item) => item !== target);
}

export function inverseClass(target: Element, className: string) {
  siblings(target).forEach((item) => removeClass(item, className));
  addClass(target, className);
}

export function tooltip(target: Element, msg: string, pos = 'top') {
  if (isMobile) return;
  target.setAttribute('aria-label', msg);
  addClass(target, 'hint--rounded');
  addClass(target, `hint--${pos}`);
}

export function isInViewport(el: Element, offset = 0) {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  const vertInView = rect.top - offset <= windowHeight && rect.top + rect.height + offset >= 0;
  const horInView = rect.left - offset <= windowWidth + offset && rect.left + rect.width + offset >= 0;
  return vertInView && horInView;
}

export function includeFromEvent(event: Event, target: Element) {
  return getComposedPath(event).includes(target);
}

export function replaceElement(newChild: Element, oldChild: Element) {
  oldChild.parentNode!.replaceChild(newChild, oldChild);
  return newChild;
}

export function createElement(tag: string) {
  return document.createElement(tag);
}

export function getIcon(key = '', html = '') {
  const icon = createElement('i');
  addClass(icon, 'art-icon');
  addClass(icon, `art-icon-${key}`);
  append(icon, html);
  return icon;
}

export function setStyleText(id: string, style: string) {
  let $style = document.getElementById(id);
  if (!$style) {
    $style = document.createElement('style');
    $style.id = id;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild($style!);
      });
    } else {
      (document.head || document.documentElement).appendChild($style);
    }
  }
  $style.textContent = style;
}

export function supportsFlex() {
  const div = document.createElement('div');
  div.style.display = 'flex';
  return div.style.display === 'flex';
}

export function getRect(el: Element) {
  return el.getBoundingClientRect();
}

export function loadImg(url: string, scale?: number) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = function () {
      if (!scale || scale === 1) {
        resolve(img);
      } else {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          const blobUrl = URL.createObjectURL(blob!);
          const scaledImg = new Image();

          scaledImg.onload = function () {
            resolve(scaledImg);
          };

          scaledImg.onerror = function () {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Image load failed: ${url}`));
          };

          scaledImg.src = blobUrl;
        });
      }
    };

    img.onerror = function () {
      reject(new Error(`Image load failed: ${url}`));
    };

    img.src = url;
  });
}

export function getComposedPath(event: Event) {
  if (event.composedPath) return event.composedPath();
  const path: EventTarget[] = [];
  let node: Node | null = event.target as Node | null;
  while (node) {
    path.push(node);
    node = node.parentNode;
  }
  if (!path.includes(window) && window !== undefined) {
    path.push(window);
  }
  return path;
}

export function getSafeAreaInsets() {
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);pointer-events:none;visibility:hidden;';
  document.body.appendChild(div);
  const style = getComputedStyle(div);
  const insets = {
    top: Number.parseFloat(style.top) || 0,
    right: Number.parseFloat(style.right) || 0,
    bottom: Number.parseFloat(style.bottom) || 0,
    left: Number.parseFloat(style.left) || 0,
  };
  div.remove();
  return insets;
}
