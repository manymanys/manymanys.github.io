(() => {
  'use strict';

  const map = document.querySelector('.network-map');
  if (!map) return;
  const visual = map.querySelector('.network-map-visual');
  const explorer = map.querySelector('.network-map-explorer');
  const select = map.querySelector('#map-country');
  const detail = map.querySelector('.network-map-detail');
  const tooltip = map.querySelector('.network-map-tooltip');
  const markers = Array.from(map.querySelectorAll('.network-map-marker'));
  const initialDetail = detail.innerHTML;
  explorer.hidden = false;

  const project = (longitude, latitude) => {
    const radians = Math.PI / 180;
    const theta = Math.asin(Math.sqrt(3) / 2 * Math.sin(latitude * radians));
    const squared = theta * theta;
    const sixth = squared * squared * squared;
    const x = 2 * Math.sqrt(3) * longitude * radians * Math.cos(theta) / (3 * (1.340264 - 3 * .081106 * squared + sixth * (7 * .000893 + 9 * .003796 * squared)));
    const y = theta * (1.340264 - .081106 * squared + sixth * (.000893 + .003796 * squared));
    return [480 + x * 170, 240 - y * 170];
  };

  const chooseCountry = (code) => {
    select.value = code;
    const template = document.getElementById(`map-country-${code}`);
    if (template) detail.replaceChildren(template.content.cloneNode(true));
    else detail.innerHTML = initialDetail;
    detail.hidden = !template;
    detail.scrollTop = 0;
    markers.forEach((marker) => {
      const selected = marker.dataset.country === code;
      marker.classList.toggle('is-selected', selected);
      marker.setAttribute('aria-pressed', String(selected));
    });
  };

  const showTooltip = (marker) => {
    tooltip.textContent = marker.dataset.label;
    tooltip.hidden = false;
  };
  select.addEventListener('change', () => chooseCountry(select.value));
  markers.forEach((marker) => {
    const [x, y] = project(Number(marker.dataset.longitude), Number(marker.dataset.latitude));
    marker.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    marker.setAttribute('aria-pressed', 'false');
    marker.addEventListener('pointerenter', () => showTooltip(marker));
    marker.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    marker.addEventListener('focus', () => showTooltip(marker));
    marker.addEventListener('blur', () => { tooltip.hidden = true; });
    marker.addEventListener('click', () => chooseCountry(marker.dataset.country));
    marker.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        chooseCountry(marker.dataset.country);
      }
      if (event.key === 'Escape') tooltip.hidden = true;
    });
  });

  const clipRing = (ring, boundary, keepGreater) => {
    const clipped = [];
    let previous = ring[ring.length - 1];
    for (const point of ring) {
      const inside = keepGreater ? point[0] >= boundary : point[0] <= boundary;
      const previousInside = keepGreater ? previous[0] >= boundary : previous[0] <= boundary;
      if (inside !== previousInside) {
        const fraction = (boundary - previous[0]) / (point[0] - previous[0]);
        clipped.push([boundary, previous[1] + fraction * (point[1] - previous[1])]);
      }
      if (inside) clipped.push(point);
      previous = point;
    }
    return clipped;
  };

  const projectRing = (ring) => {
    if (ring.length < 3 || ring.every((point) => point[1] < -60)) return '';
    const unwrapped = [ring[0]];
    for (const point of ring.slice(1)) {
      let longitude = point[0];
      const previous = unwrapped[unwrapped.length - 1][0];
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
      unwrapped.push([longitude, point[1]]);
    }
    const longitudes = unwrapped.map((point) => point[0]);
    const first = Math.floor((Math.min(...longitudes) + 180) / 360);
    const last = Math.floor((Math.max(...longitudes) + 180) / 360);
    const paths = [];
    for (let world = first; world <= last; world += 1) {
      const offset = world * 360;
      let part = clipRing(unwrapped, offset - 180, true);
      if (part.length < 3) continue;
      part = clipRing(part, offset + 180, false);
      if (part.length < 3) continue;
      const area = part.reduce((sum, point, index) => {
        const next = part[(index + 1) % part.length];
        return sum + point[0] * next[1] - next[0] * point[1];
      }, 0);
      if (Math.abs(area) < 1e-8) continue;
      paths.push(part.map((point, index) => {
        const [x, y] = project(point[0] - offset, point[1]);
        return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join('') + 'Z');
    }
    return paths.join('');
  };

  const drawCountries = (topology) => {
    const { scale, translate } = topology.transform;
    const arcs = topology.arcs.map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map((point) => {
        x += point[0];
        y += point[1];
        return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
      });
    });
    const ringPath = (indices) => {
      const ring = [];
      indices.forEach((index) => {
        const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
        if (ring.length) ring.pop();
        ring.push(...arc);
      });
      return projectRing(ring);
    };
    const paths = topology.objects.countries.geometries.map((geometry) => {
      const polygons = geometry.type === 'Polygon' ? [geometry.arcs] : geometry.arcs;
      return polygons.map((polygon) => polygon.map(ringPath).join('')).join('');
    });
    map.querySelector('.network-map-land').setAttribute('d', paths.join(''));
    visual.hidden = false;
    map.classList.add('is-map-ready');
  };

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json', {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: controller.signal,
  }).then((response) => {
    if (!response.ok) throw new Error('Map data unavailable');
    return response.json();
  }).then(drawCountries).catch(() => {
    map.querySelector('.network-map-error').hidden = false;
  }).finally(() => window.clearTimeout(timeout));
})();
