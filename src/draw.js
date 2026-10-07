// Zeichenbaukasten für alle Stationen von Schnittpunkt: Maßstab, Grundformen, Beschriftungen mit Platzwahl,
// Tragwerk (Lager, Träger, Lasten, Bemaßung) und Säge. Weltkoordinaten in m, x nach rechts, z nach unten, Kräfte in kN.
(function (root) {
  'use strict';
  const BODY = '"Barlow", "Helvetica Neue", Arial, sans-serif', MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  const FS = 0.3;            // Kraftpfeile: m je kN, in allen Stationen gleich, damit sich Pfeile vergleichen lassen
  const MS = Math.PI / 6;    // Momentenbogen: 30° je kNm
  const HB = 0.16, GAP = 0.06, RSAW = 0.3;   // Trägerhöhe, Sägespalt, Radius des Sägeblatts (m)
  const num = v => (v < -1e-9 ? '−' : '') + (Math.round(Math.abs(v) * 1000) / 1000).toLocaleString('de-DE');   // bis drei Nachkommastellen, 2,25 bleibt 2,25
  const signed = v => (v > 1e-9 ? '+' : '') + num(v);
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const neg = v => [-v[0], -v[1]];

  function colors(C) {
    const cs = getComputedStyle(document.documentElement);
    for (const t of ['sheet', 'ink', 'ink2', 'rule', 'steel', 'steel2', 'accent', 'cN', 'cQ', 'cM', 'react', 'cut', 'ok', 'bad'])
      C[t] = cs.getPropertyValue('--' + t).trim();
  }
  // Maßstab: Ausschnitt view = [x0, z0, x1, z1] so groß wie möglich in die Breite von wrap, höchstens knapp zwei Drittel der Fensterhöhe
  function fit(cv, wrap, view) {
    const [x0, z0, x1, z1] = view, W = wrap.clientWidth;
    if (!W) return null;
    const maxH = Math.max(280, Math.min(innerHeight * 0.64, 600));
    const s = Math.min(W / (x1 - x0), maxH / (z1 - z0)), H = Math.round(s * (z1 - z0)), dpr = devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    return { s, W, H, dpr, ox: (W - s * (x1 - x0)) / 2, x0, z0 };
  }

  // Werkzeuge für eine Zeichenfläche. env: G() Maßstab aus fit, C Farben, P(s) Punkt auf der Stabachse, ex() und ez() Achsen, now() Zeit
  function make(ctx, env) {
    const C = env.C, P = s => env.P(s), ex = () => env.ex(), ez = () => env.ez();
    const px = n => n / env.G().s;   // Pixel in Metern
    function worldView() {
      const G = env.G();
      ctx.setTransform(G.dpr * G.s, 0, 0, G.dpr * G.s, G.dpr * (G.ox - G.x0 * G.s), -G.dpr * G.z0 * G.s);
    }

    // Je Bild belegt (Bildschirmpixel): Beschriftungen als Rechteck, Pfeilspitzen und Griffe als Kreis. Neue Beschriftungen weichen aus
    const boxes = [], marks = [];
    function reset() { boxes.length = 0; marks.length = 0; }
    const screenOf = p => { const m = ctx.getTransform(), d = env.G().dpr; return [(m.a * p[0] + m.c * p[1] + m.e) / d, (m.b * p[0] + m.d * p[1] + m.f) / d]; };
    function line(a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    function head(h, u, hl, hw) {
      ctx.beginPath(); ctx.moveTo(h[0], h[1]);
      ctx.lineTo(h[0] - u[0] * hl - u[1] * hw, h[1] - u[1] * hl + u[0] * hw);
      ctx.lineTo(h[0] - u[0] * hl + u[1] * hw, h[1] - u[1] * hl - u[0] * hw);
      ctx.closePath(); ctx.fill();
      marks.push({ p: screenOf([h[0] - u[0] * hl / 2, h[1] - u[1] * hl / 2]), r: hl * env.G().s * 0.6 + 2 });
    }
    function arrow(t, h, col, w = 2.2, hd = 11, dash = false) {
      const L = Math.hypot(h[0] - t[0], h[1] - t[1]);
      if (L < 1e-9) return;
      const u = [(h[0] - t[0]) / L, (h[1] - t[1]) / L], hl = Math.min(px(hd), L * 0.7);
      ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = px(w); ctx.lineCap = 'round';
      if (dash) ctx.setLineDash([px(5), px(4)]);
      line(t, [h[0] - u[0] * hl * 0.9, h[1] - u[1] * hl * 0.9]);
      head(h, u, hl, hl * 0.42);
      ctx.restore();
    }
    // Momentenpfeil um c ab dem Canvas-Winkel a0: m in kNm (positiv gegen den Uhrzeigersinn), 30° je kNm;
    // gibt Spitze, Anfangs- und Endwinkel zurück
    function momArc(c, m, r, col, w = 2.6, dash = false, a0 = -Math.PI / 2) {
      const th = m * MS, a1 = a0 - th, sg = Math.sign(th);   // Canvas-Winkel wachsen im Uhrzeigersinn
      const tip = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
      if (!th) return { tip, a0, a1 };
      const hl = Math.min(px(12), Math.abs(th) * r * 0.7);
      ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = px(w); ctx.lineCap = 'round';
      if (dash) ctx.setLineDash([px(5), px(4)]);
      ctx.beginPath(); ctx.arc(c[0], c[1], r, a0, a1 + sg * hl * 0.9 / r, th > 0); ctx.stroke();
      head(tip, th > 0 ? [Math.sin(a1), -Math.cos(a1)] : [-Math.sin(a1), Math.cos(a1)], hl, hl * 0.42);
      ctx.restore();
      return { tip, a0, a1 };
    }
    const fontOf = o => `${o.weight || 500} ${o.size || 13}px ${o.font || MONO}`;
    // Fläche einer Beschriftung in Bildschirmpixeln (mit Rand), Text an p mit Ausrichtung o.align
    function boxAt(str, p, o) {
      const [X, Y] = screenOf(p), h = (o.size || 13) + 5;
      ctx.save(); ctx.font = fontOf(o); const w = ctx.measureText(str).width + 8; ctx.restore();
      const x0 = o.align === 'left' ? X - 4 : o.align === 'right' ? X - w + 4 : X - w / 2;
      return { X, Y, x0, y0: Y - h / 2, x1: x0 + w, y1: Y + h / 2 };
    }
    // Text auf hinterlegtem Feld an einem Weltpunkt: folgt Verschiebung und Drehung, bleibt aber aufrecht, Linien darunter stören nicht
    function label(str, p, col, o = {}) {
      const b = boxAt(str, p, o), d = env.G().dpr;
      ctx.save(); ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = C.sheet; ctx.beginPath(); ctx.roundRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 3); ctx.fill();
      ctx.font = fontOf(o); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = col; ctx.fillText(str, b.X, b.Y);
      ctx.restore();
      boxes.push(b);
    }
    // Wie stark eine Fläche Belegtes trifft: überlappende Beschriftungen nach Fläche, Pfeilspitzen und Griffe pauschal
    function clash(b) {
      let s = 0;
      for (const q of boxes) s += Math.max(0, Math.min(b.x1, q.x1) - Math.max(b.x0, q.x0) + 2) * Math.max(0, Math.min(b.y1, q.y1) - Math.max(b.y0, q.y0) + 2);
      for (const m of marks) {
        const dx = Math.max(b.x0 - m.p[0], 0, m.p[0] - b.x1), dy = Math.max(b.y0 - m.p[1], 0, m.p[1] - b.y1);
        if (dx * dx + dy * dy < m.r * m.r) s += 400;
      }
      return s;
    }
    // Beschriftung an der ersten freien Stelle aus spots ([Weltpunkt, Ausrichtung]), sonst an der am wenigsten belegten
    function place(str, col, spots, o = {}) {
      let best = spots[0], least = Infinity;
      for (const sp of spots) {
        const hit = clash(boxAt(str, sp[0], { ...o, align: sp[1] }));
        if (hit < least) { least = hit; best = sp; }
        if (!hit) break;
      }
      label(str, best[0], col, { ...o, align: best[1] });
    }
    const alignOf = v => (v[0] > 0.5 ? 'left' : v[0] < -0.5 ? 'right' : 'center');
    const beside = (p, v, d) => [add(p, v, px(d)), alignOf(v)];   // Platz d Pixel neben p in Richtung v
    // Plätze außen am Momentenbogen: an der Spitze, in der Mitte, am Anfang, weiter draußen an der Spitze
    function arcSpots(c, r, arc) {
      const at = (a, d) => { const u = [Math.cos(a), Math.sin(a)]; return beside(add(c, u, r), u, d); };
      return [at(arc.a1, 22), at((arc.a0 + arc.a1) / 2, 22), at(arc.a0, 22), at(arc.a1, 46)];
    }
    function knob(p, col, pulsing) {
      marks.push({ p: screenOf(p), r: 12 });
      ctx.save();
      if (pulsing) {
        const k = 0.5 + 0.5 * Math.sin(env.now() / 260);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.2 + 0.5 * (1 - k); ctx.lineWidth = px(2);
        ctx.beginPath(); ctx.arc(p[0], p[1], px(11 + 8 * k), 0, 2 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = col; ctx.strokeStyle = C.sheet; ctx.lineWidth = px(2);
      ctx.beginPath(); ctx.arc(p[0], p[1], px(7.5), 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // Lager wie in Knotenpunkt: Einspannung als Wand mit Schraffur, Fest- und Loslager als Dreieck mit Gelenk
    function support(sp) {
      const p = P(sp.s);
      ctx.save(); ctx.strokeStyle = C.ink; ctx.fillStyle = C.sheet;
      if (sp.kind === 'einspannung') {
        const out = sp.s === 0 ? neg(ex()) : ex(), q = ez(), w = 0.42;
        ctx.lineWidth = px(2.6); line(add(p, q, -w), add(p, q, w));
        ctx.lineWidth = px(1);
        for (let k = -w; k <= w + 1e-9; k += 0.105) { const a = add(p, q, k); line(a, add(add(a, out, 0.14), q, -0.1)); }
      } else {
        const top = [p[0], p[1] + HB / 2], h = 0.32, w = 0.4, gy = top[1] + h + (sp.kind === 'los' ? 0.07 : 0);
        ctx.lineWidth = px(1.6);
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(top[0] - w / 2, top[1] + h); ctx.lineTo(top[0] + w / 2, top[1] + h);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        line([top[0] - w * 0.75, gy], [top[0] + w * 0.75, gy]);
        ctx.lineWidth = px(1);
        for (let x = -w * 0.75; x < w * 0.75 - 1e-9; x += 0.09) line([top[0] + x + 0.09, gy], [top[0] + x, gy + 0.09]);
        ctx.lineWidth = px(1.6);
        ctx.beginPath(); ctx.arc(top[0], top[1], 0.045, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        if (sp.name) label(sp.name, [top[0] - w * 0.75 - 0.1, top[1] + h * 0.45], C.ink2, { font: BODY, weight: 600, size: 14, align: 'right' });
      }
      ctx.restore();
    }
    function member(s0, s1, ghost) {
      if (s1 - s0 < 1e-9) return;
      const q = ez(), h = HB / 2, a = P(s0), b = P(s1);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(...add(a, q, -h)); ctx.lineTo(...add(b, q, -h)); ctx.lineTo(...add(b, q, h)); ctx.lineTo(...add(a, q, h));
      ctx.closePath(); ctx.fillStyle = ghost ? C.sheet : C.steel; ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.6);
      if (ghost) ctx.setLineDash([px(4), px(3)]);
      ctx.stroke(); ctx.restore();
    }
    // Lasten aus list im Bereich [s0, s1]: Einzellasten drücken mit der Spitze auf den Träger oder ziehen vom Angriffspunkt weg (pull).
    // Mit later kommen die Beschriftungen in die Liste, statt gleich gezeichnet zu werden. cut: Schnittstelle, an der die Pfeile
    // einer Streckenlast einrücken (dort sitzt der eigene Querkraftpfeil), sonst null
    function loads(list, s0, s1, withLabel = true, later, cut = null) {
      for (const ld of list) {
        if (ld.q) {
          const a = Math.max(s0, ld.s0), b = Math.min(s1, ld.s1);
          if (b - a > 1e-9) lineLoad(ld, a, b, withLabel, later, cut);
        } else if (ld.s >= s0 - 1e-9 && ld.s <= s1 + 1e-9) pointLoad(ld.s, ld.f, C.ink, ld.name || 'F', ld.pull, ld.parts, withLabel, later);
      }
    }
    // Beschriftung gleich am ersten Platz zeichnen oder für später vormerken
    function put(later, str, col, spots, o = {}) {
      if (later) later.push([str, col, spots, o]); else label(str, spots[0][0], col, { ...o, align: spots[0][1] });
    }
    function pointLoad(s, f, col, name, pull, parts, withLabel = true, later) {
      const p = P(s), n = Math.hypot(f[0], f[1]);
      if (n < 1e-9) return;
      const u = [f[0] / n, f[1] / n], len = n * FS, perp = [-u[1], u[0]];
      const t = pull ? p : add(add(p, u, -HB / 2), u, -len), h = pull ? add(p, u, len) : add(p, u, -HB / 2);
      arrow(t, h, col, 2.2, 12);
      if (parts) {   // Zerlegung in waagerecht und senkrecht
        const k = [h[0], p[1]];
        ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1.2); ctx.setLineDash([px(4), px(3)]);
        line(p, k); line(k, h); ctx.restore();
        if (withLabel) {
          put(later, `${num(Math.abs(f[0]))} kN`, C.ink2, [beside([(p[0] + k[0]) / 2, p[1]], [0, -1], 15), beside([(p[0] + k[0]) / 2, p[1]], [0, 1], 15)]);
          put(later, `${num(Math.abs(f[1]))} kN`, C.ink2, [beside([k[0], (p[1] + h[1]) / 2], [1, 0], 8), beside([k[0], (p[1] + h[1]) / 2], [-1, 0], 8)]);
        }
      }
      if (!withLabel) return;
      const side = u[0] > 0.9 ? 1 : u[0] < -0.9 ? -1 : 0, at = pull ? add(h, u, 0.2) : add(t, u, -0.2);   // schräg: mittig
      const end = pull ? h : t;
      put(later, `${name} = ${num(n)} kN`, col, [[at, [pull ? 'right' : 'left', 'center', pull ? 'left' : 'right'][side + 1]],
        beside(end, perp, 10), beside(end, neg(perp), 10)]);
    }
    // Streckenlast (senkrecht auf waagerechtem Träger) als Pfeilreihe mit Begrenzungslinie
    function lineLoad(ld, a, b, withLabel, later, cut) {
      const top = -HB / 2, h = 0.45, cutEnd = s => cut != null && Math.abs(s - cut) <= GAP + 1e-9;
      const a1 = a + (cutEnd(a) ? 0.15 : 0), b1 = b - (cutEnd(b) ? 0.15 : 0), n = Math.max(1, Math.round((b1 - a1) / 0.4));
      for (let k = 0; k <= n; k++) { const x = P(a1 + (b1 - a1) * k / n)[0]; arrow([x, top - h], [x, top], C.ink, 1.5, 8); }
      ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.5); line([P(a)[0], top - h], [P(b)[0], top - h]); ctx.restore();
      if (!withLabel) return;
      const z = top - h - px(13), xa = P(a)[0], xb = P(b)[0];
      put(later, `q = ${num(ld.q[1])} kN/m`, C.ink, [[[(xa + xb) / 2, z], 'center'], [[xb, z], 'right'], [[xa, z], 'left']]);
    }
    // Bemaßung des Levels lv entlang der Achse, quer versetzt um lv.dimOff
    function dims(lv) {
      const q = ez(), off = lv.dimOff, side = Math.abs(q[0]) > 0.5;   // side: neben einem senkrechten Stab
      const pts = lv.dims.map(s => add(P(s), q, off));
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.lineWidth = px(1);
      line(pts[0], pts[pts.length - 1]);
      for (const p of pts) line(add(p, q, -0.1), add(p, q, 0.1));
      ctx.restore();
      for (let k = 1; k < pts.length; k++) {
        const m = [(pts[k - 1][0] + pts[k][0]) / 2, (pts[k - 1][1] + pts[k][1]) / 2];
        label(`${num(lv.dims[k] - lv.dims[k - 1])} m`, add(m, q, Math.sign(off) * (side ? 0.12 : 0.2)), C.ink2, side ? { align: 'left' } : {});
      }
    }
    // Koordinatensystem wie auf der TM1-Folie: x nach rechts, z nach unten, y zum Betrachter
    function axesIcon() {
      const G = env.G(), o = [G.x0 + 0.34, G.z0 + 0.34], r = 0.075;
      arrow([o[0] + r, o[1]], [o[0] + 0.6, o[1]], C.ink2, 1.4, 8);
      arrow([o[0], o[1] + r], [o[0], o[1] + 0.6], C.ink2, 1.4, 8);
      ctx.save(); ctx.strokeStyle = C.ink2; ctx.fillStyle = C.ink2; ctx.lineWidth = px(1.3);
      ctx.beginPath(); ctx.arc(o[0], o[1], r, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(o[0], o[1], 0.02, 0, 2 * Math.PI); ctx.fill(); ctx.restore();
      label('x', [o[0] + 0.7, o[1]], C.ink2, { font: BODY, size: 14, align: 'left' });
      label('z', [o[0], o[1] + 0.74], C.ink2, { font: BODY, size: 14 });
      label('y', [o[0] - 0.11, o[1] - 0.11], C.ink2, { font: BODY, size: 13, align: 'right' });
    }
    // Schnittmarke wie in der Vorlesung: rote Wellenlinie quer zur Achse bei s
    function cutMark(s) {
      const c = P(s), q = ez(), e = ex();
      ctx.save(); ctx.strokeStyle = C.cut; ctx.lineWidth = px(2.6); ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k <= 30; k++) {
        const t = -0.32 + 0.64 * k / 30, p = add(add(c, q, t), e, 0.05 * Math.sin(t / 0.64 * 3 * Math.PI));
        if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      }
      ctx.stroke(); ctx.restore();
    }
    // Kreissägeblatt um center, um ang gedreht
    function drawSaw(center, ang) {
      const N = 18, R = RSAW, r = R * 0.84;
      ctx.save(); ctx.translate(center[0], center[1]); ctx.rotate(ang);
      ctx.beginPath();
      for (let k = 0; k < N; k++) {
        const a = k / N * 2 * Math.PI, b = (k + 0.65) / N * 2 * Math.PI;
        ctx.lineTo(R * Math.cos(a), R * Math.sin(a)); ctx.lineTo(r * Math.cos(b), r * Math.sin(b));
      }
      ctx.closePath(); ctx.fillStyle = C.steel2; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, 2 * Math.PI); ctx.strokeStyle = C.sheet; ctx.lineWidth = px(1.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, 2 * Math.PI); ctx.fillStyle = C.sheet; ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.4); ctx.stroke();
      ctx.restore();
    }

    return { px, worldView, reset, screenOf, line, head, arrow, momArc, boxAt, label, clash, place, alignOf, beside, arcSpots, knob,
      support, member, loads, put, pointLoad, lineLoad, dims, axesIcon, cutMark, drawSaw };
  }

  root.KIT = { BODY, MONO, FS, MS, HB, GAP, RSAW, num, signed, add, neg, colors, fit, make };
})(this);
