/**
 * SVG 图标模块 - Trusted Types Safe
 */

const ICON_PATHS = {
    folder: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
    file: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7',
    logo: 'M16 18l6-6-6-6 M8 6l-6 6 6 6 M12.5 4l-3 16',
    close: 'M18 6L6 18M6 6l12 12',
    arrowRight: 'M9 18l6-6-6-6',
    arrowDown: 'M6 9l6 6 6-6'
};

/**
 * 创建 SVG 图标
 */
export function createIcon(name, size = 14, color = 'currentColor') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('ide-icon');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.file);
    svg.appendChild(path);
    
    return svg;
}
