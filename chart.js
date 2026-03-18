const CardCharts = {

  CONFIG: {
    barBorderRadius: 6,
    barPercentage:   0.5,

    lineTension:                0.4,
    linePointRadius:            0,
    lineEndDotRadius:           5,
    lineBorderWidth:            2,
    lineReferenceColor:         'rgba(255,255,255,0.15)',
    lineReferenceLabelBg:       '#e05252',
    lineReferenceLabelColor:    '#ffffff',
    lineReferenceLabelFontSize: 11,
    lineReferenceLabelPadX:     6,
    lineReferenceLabelPadY:     3,
    lineAxisColor:              'rgba(255,255,255,0.2)',
    lineAxisLabelColor:         'rgba(255,255,255,0.4)',
    lineAxisFontSize:           10,

    dotGridColumns:     5,
    dotGridRows:        4,
    dotRadius:          8,
    dotHighlightColor:  '#c8a96e',
    dotDimColor:        '#3a3a3a',

    donutCutout:        '80%',
    donutTrackCutout:   '85%',
    donutFallbackColor: '#2a2a2a',

    gaugeMin:         0,
    gaugeMax:         1000,
    gaugeCutout:      '85%',
    gaugeAnimationMs: 1200,

    barStackedBorderRadius: 4,
    barStackedPercentage:   0.7,
    barStackedAxisColor:    'rgba(255,255,255,0.2)',
    barStackedLabelColor:   'rgba(255,255,255,0.4)',
    barStackedFontSize:     11,

    sankeyNodeWidth:   10,
    sankeyFontSize:    12,
    sankeyLabelColor:  'rgba(255,255,255,0.7)',
    sankeyNodeColor:   '#4a9eff',
    sankeyLinkOpacity: 0.45,

    riskTrendDays:           30,
    riskTrendRandomStep:     120,
    riskTrendAnchorPull:     0.03,
    riskTrendPointRadius:    0,
    riskTrendLastPointRadius:6,
    riskTrendLineWidth:      4,
    riskTrendLineTension:    0,
    riskTrendAnimationMs:    800,
    riskTrendGridColor:      'rgba(255,255,255,0.08)',
    riskTrendTickColor:      'rgba(255,255,255,0.4)',
    riskTrendTickFontSize:   10,
    riskTrendCrosshairColor: 'rgba(255,255,255,0.3)',
    riskTrendCrosshairWidth: 1,
    riskTrendCrosshairDash:  [4, 4],

    gradientPresets: {
      red: {
        direction: 'vertical',
        stops: [
          { position: 0,    color: 'rgba(20, 4, 4, 1)'    },
          { position: 0.3,  color: 'rgba(80, 14, 10, 1)'  },
          { position: 0.65, color: 'rgba(238, 91, 66, 1)' },
          { position: 0.88, color: 'rgba(238, 91, 66, 1)' },
          { position: 1,    color: 'rgba(238, 91, 66, 1)' },
        ],
      },
      green: {
        direction: 'vertical',
        stops: [
          { position: 0,   color: 'rgba(10, 80, 30, 0.9)' },
          { position: 0.5, color: 'rgba(30, 160, 70, 1)'  },
          { position: 1,   color: 'rgba(80, 230, 120, 1)' },
        ],
      },
      'green-orange': {
        direction: 'horizontal',
        stops: [
          { position: 0,    color: 'rgba(30, 120, 40, 0.9)' },
          { position: 0.4,  color: 'rgba(180, 190, 20, 1)'  },
          { position: 0.75, color: 'rgba(220, 120, 20, 1)'  },
          { position: 1,    color: 'rgba(220, 80, 20, 1)'   },
        ],
      },
      gauge: {
        direction: 'horizontal',
        stops: [
          { position: 0,    color: '#7ED321' },
          { position: 0.45, color: '#F5A623' },
          { position: 0.75, color: '#E8621A' },
          { position: 1,    color: '#D0021B' },
        ],
      },
    },
  },

  SEL: {
    canvas: '[data-chart]',
  },

  STATE: {
    instances: [],
  },

  init() {
    if (typeof Chart === 'undefined') {
      console.error('[CardCharts] Chart.js not loaded.');
      return;
    }
    if (typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
    }
    this._registerCrosshairPlugin();
    this._registerSuppressNaNPlugin();
    requestAnimationFrame(() => {
      document.querySelectorAll(this.SEL.canvas).forEach((canvasEl) => this._dispatch(canvasEl));
    });
  },

  _dispatch(canvasEl) {
    const chartType   = canvasEl.dataset.chart;
    const chartConfig = this._parseConfig(canvasEl);

    const factories = {
      'bar':            () => this._buildBar(canvasEl, chartConfig),
      'line':           () => this._buildLine(canvasEl, chartConfig),
      'dot-grid':       () => this._buildDotGrid(canvasEl, chartConfig),
      'donut':          () => this._buildDonut(canvasEl, chartConfig),
      'donut-track':    () => this._buildDonutTrack(canvasEl, chartConfig),
      'gauge':          () => this._buildGauge(canvasEl, chartConfig),
      'bar-horizontal': () => this._buildBarStacked(canvasEl, chartConfig, 'y'),
      'bar-grouped':    () => this._buildBarStacked(canvasEl, chartConfig, 'x'),
      'sankey':         () => this._buildSankey(canvasEl, chartConfig),
      'risk-trend':     () => this._buildRiskTrend(canvasEl, chartConfig),
    };

    if (!factories[chartType]) {
      console.warn(`[CardCharts] Unknown type "${chartType}"`);
      return;
    }

    try {
      const instance = factories[chartType]();
      if (instance) this.STATE.instances.push(instance);
    } catch (err) {
      console.error(`[CardCharts] Failed to build "${chartType}":`, err);
    }
  },

  _buildBar(canvas, config) {
    const dataset = config.datasets?.[0];
    const values  = this._resolveValues(dataset);
    if (!values.length) {
      console.warn('[CardCharts] bar: no datasets[0].values');
      return null;
    }
    const ctx = canvas.getContext('2d');
    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels:   values.map((_, i) => i),
        datasets: [{
          data:            values,
          backgroundColor: (context) => this._buildBarGradient(context.chart, dataset.color || 'red'),
          borderColor:     'transparent',
          borderRadius:    this.CONFIG.barBorderRadius,
          borderSkipped:   'bottom',
        }],
      },
      options: {
        ...this._baseOptions(),
        scales:   { x: { display: false }, y: { display: false } },
        datasets: { bar: { barPercentage: this.CONFIG.barPercentage } },
      },
    });
  },

  _buildLine(canvas, config) {
    const dataset = config.datasets?.[0];
    const values  = this._resolveValues(dataset, config.labels?.length);
    if (!values.length) {
      console.warn('[CardCharts] line: no datasets[0].values');
      return null;
    }
    const ctx       = canvas.getContext('2d');
    const color     = dataset.color || '#e05252';
    const refLines  = dataset.referenceLines  || [];
    const refLabels = dataset.referenceLabels || [];
    const C         = this.CONFIG;
    const refColor  = dataset.referenceColor || C.lineReferenceColor;

    const xAxis = {
      show:       dataset.showX       ?? config.showAxes ?? false,
      color:      dataset.xAxisColor  || dataset.axisColor      || C.lineAxisColor,
      labelColor: dataset.xLabelColor || dataset.axisLabelColor || C.lineAxisLabelColor,
    };
    const yAxis = {
      show:       dataset.showY       ?? config.showAxes ?? false,
      color:      dataset.yAxisColor  || dataset.axisColor      || C.lineAxisColor,
      labelColor: dataset.yLabelColor || dataset.axisLabelColor || C.lineAxisLabelColor,
    };

    const pointRadii = values.map((_, i) =>
      (dataset.endDot && i === values.length - 1)
        ? C.lineEndDotRadius
        : C.linePointRadius
    );

    const refDatasets = refLines.map((value) => ({
      data:             values.map(() => value),
      borderColor:      refColor,
      borderWidth:      1,
      borderDash:       [4, 4],
      pointRadius:      0,
      pointHoverRadius: 0,
      fill:             false,
      tension:          0,
      label:            '',
    }));

    const buildAxisConfig = (axis) => ({
      display: axis.show,
      grid:    { color: axis.color },
      ticks:   { color: axis.labelColor, font: { size: C.lineAxisFontSize } },
      border:  { display: false },
    });

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels:   config.labels || [],
        datasets: [
          {
            data:                 values,
            borderColor:          color,
            borderWidth:          C.lineBorderWidth,
            tension:              C.lineTension,
            pointRadius:          pointRadii,
            pointBackgroundColor: color,
            fill:                 dataset.fill ? 'origin' : false,
            backgroundColor:      dataset.fill
              ? this._buildGradient(ctx, 0, 0, 0, canvas.height || 200, [
                  { position: 0, color: this._colorWithOpacity(color, 0.4) },
                  { position: 1, color: this._colorWithOpacity(color, 0)   },
                ])
              : 'transparent',
          },
          ...refDatasets,
        ],
      },
      plugins: [this._buildReferenceLabelPlugin(refLines, refLabels)],
      options: {
        ...this._baseOptions(),
        layout: { padding: (xAxis.show || yAxis.show) ? { left: 4, right: 8, top: 8, bottom: 4 } : 0 },
        scales: { x: buildAxisConfig(xAxis), y: buildAxisConfig(yAxis) },
      },
    });
  },

  _buildDotGrid(canvas, config) {
    if (!config.total) {
      console.warn('[CardCharts] dot-grid: no total');
      return null;
    }
    const ctx            = canvas.getContext('2d');
    const columns        = config.columns || this.CONFIG.dotGridColumns;
    const rows           = config.rows    || this.CONFIG.dotGridRows;
    const highlightColor = config.datasets?.[0]?.color || this.CONFIG.dotHighlightColor;
    const dimColor       = config.datasets?.[1]?.color || this.CONFIG.dotDimColor;
    const allPoints      = this._buildDotGridPoints(config.total, columns, rows);

    return new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [
          { data: allPoints.slice(0, config.highlighted || 0), backgroundColor: highlightColor },
          { data: allPoints.slice(config.highlighted    || 0), backgroundColor: dimColor       },
        ],
      },
      options: {
        ...this._baseOptions(),
        scales: {
          x: { display: false, min: -0.5, max: columns - 0.5 },
          y: { display: false, min: -0.5, max: rows    - 0.5 },
        },
      },
    });
  },

  _buildDonut(canvas, config) {
    if (!config.datasets?.length) {
      console.warn('[CardCharts] donut: no datasets');
      return null;
    }
    const ctx   = canvas.getContext('2d');
    const total = config.datasets.reduce((sum, dataset) => sum + (dataset.value || 0), 0);

    const instance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data:            config.datasets.map((dataset) => dataset.value),
          backgroundColor: config.datasets.map((dataset) => dataset.color || this.CONFIG.donutFallbackColor),
          borderWidth:     config.gap || 0,
          borderColor:     'transparent',
          spacing:         config.spacing || 0,
        }],
      },
      options: {
        ...this._baseOptions(),
        cutout: this.CONFIG.donutCutout,
        plugins: {
          legend:     { display: false },
          datalabels: { display: false },
          tooltip:    { mode: 'nearest', intersect: true },
        },
      },
    });

    this._postBuild(canvas, total, config.datasets.map((dataset) => ({
      color:      dataset.color,
      label:      dataset.label || '',
      value:      dataset.value,
      percentage: total > 0 ? ((dataset.value / total) * 100).toFixed(1) : '0.0',
    })));

    return instance;
  },

  _buildDonutTrack(canvas, config) {
    if (config.datasets?.length < 2) {
      console.warn('[CardCharts] donut-track: needs 2 datasets (accent, track)');
      return null;
    }
    const ctx           = canvas.getContext('2d');
    const accent        = config.datasets[0];
    const track         = config.datasets[1];
    const accentClamped = Math.min(accent.value, track.value);
    const remainder     = track.value - accentClamped;
    const gap           = config.gap || 0;

    const instance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [
          {
            data:            [track.value],
            backgroundColor: [track.color || this.CONFIG.donutFallbackColor],
            borderWidth:     0,
            weight:          10,
          },
          {
            data:            [1],
            backgroundColor: ['transparent'],
            borderWidth:     0,
            weight:          gap,
          },
          {
            data:            [accentClamped, remainder],
            backgroundColor: [accent.color || this.CONFIG.donutFallbackColor, 'transparent'],
            borderWidth:     0,
            borderRadius:    [6, 0],
            borderSkipped:   false,
            weight:          10,
          },
        ],
      },
      options: {
        ...this._baseOptions(),
        cutout: this.CONFIG.donutTrackCutout,
        plugins: {
          legend:     { display: false },
          datalabels: { display: false },
          tooltip:    { mode: 'nearest', intersect: true },
        },
      },
    });

    this._postBuild(canvas, track.value, [
      {
        color:      track.color,
        label:      track.label  || '',
        value:      track.value,
        percentage: '100.0',
      },
      {
        color:      accent.color,
        label:      accent.label || '',
        value:      accentClamped,
        percentage: track.value > 0 ? ((accentClamped / track.value) * 100).toFixed(1) : '0.0',
      },
    ]);

    return instance;
  },

  _buildGauge(canvas, config) {
    const ctx   = canvas.getContext('2d');
    const min   = config.min   ?? this.CONFIG.gaugeMin;
    const max   = config.max   ?? this.CONFIG.gaugeMax;
    const value = Math.min(Math.max(config.value ?? min, min), max);
    const color = config.datasets?.[0]?.color || 'gauge';
    const C     = this.CONFIG;

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data:            [value, max - value],
          backgroundColor: [this._resolveColor(ctx, null, color, canvas), 'transparent'],
          borderWidth:     0,
          borderRadius:    [10, 0],
        }],
      },
      options: {
        ...this._baseOptions(),
        rotation:      -90,
        circumference: 180,
        cutout:        C.gaugeCutout,
        animation:     { duration: C.gaugeAnimationMs, easing: 'easeOutQuart' },
        plugins: { ...this._baseOptions().plugins, tooltip: { enabled: false } },
      },
    });
  },

  _buildBarStacked(canvas, config, axis) {
    if (!config.datasets?.length) {
      console.warn('[CardCharts] bar-stacked: no datasets');
      return null;
    }
    const ctx          = canvas.getContext('2d');
    const C            = this.CONFIG;
    const isHorizontal = axis === 'y';

    const chartDatasets = config.datasets.map((dataset) => ({
      label:           dataset.label || '',
      data:            this._resolveValues(dataset),
      backgroundColor: dataset.color || C.sankeyNodeColor,
      borderRadius:    dataset.borderRadius ?? C.barStackedBorderRadius,
      borderSkipped:   false,
      labelColor:      dataset.labelColor || '#ffffff',
    }));

    const showXAxis   = config.showXAxis   ?? !isHorizontal;
    const showYAxis   = config.showYAxis   ?? isHorizontal;
    const xAxisColor  = config.xAxisColor  || C.barStackedAxisColor;
    const yAxisColor  = config.yAxisColor  || C.barStackedAxisColor;
    const xLabelColor = config.xLabelColor || C.barStackedLabelColor;
    const yLabelColor = config.yLabelColor || C.barStackedLabelColor;
    const fontSize    = config.fontSize    || C.barStackedFontSize;
    const showLabels  = config.dataLabels === true;

    const buildAxis = (show, gridColor, labelColor) => ({
      display: show,
      stacked: true,
      grid:    { color: gridColor },
      ticks:   { color: labelColor, font: { size: fontSize } },
      border:  { display: false },
    });

    return new Chart(ctx, {
      type: 'bar',
      data: { labels: config.labels || [], datasets: chartDatasets },
      options: {
        ...this._baseOptions(),
        indexAxis: axis,
        scales: {
          x: buildAxis(showXAxis, xAxisColor, xLabelColor),
          y: buildAxis(showYAxis, yAxisColor, yLabelColor),
        },
        datasets: { bar: { barPercentage: C.barStackedPercentage } },
        plugins: {
          legend:     { display: false },
          tooltip:    { mode: 'index', axis: isHorizontal ? 'y' : 'x', intersect: false },
          datalabels: showLabels ? {
            color:     (context) => context.dataset.labelColor || '#ffffff',
            font:      { size: 12, weight: '600' },
            formatter: (value) => value > 0 ? value : '',
            anchor:    'center',
            align:     'center',
            clamp:     true,
          } : { display: false },
        },
      },
    });
  },

  _buildRiskTrend(canvas, config) {
    if (!config.datasets?.length) {
      console.warn('[CardCharts] risk-trend: no datasets');
      return null;
    }
    const ctx    = canvas.getContext('2d');
    const C      = this.CONFIG;
    const min    = config.min ?? 0;
    const max    = config.max ?? 1000;
    const days   = C.riskTrendDays;
    const labels = Array.from({ length: days }, (_, i) => String(i + 1));
    const yTicks = config.yTicks || [min, max];
    const yGrids = config.yGrids || [min, max];

    const chartDatasets = config.datasets.map((dataset) => {
      const score   = dataset.score ?? max;
      const history = this._generateMockData(score, min, max);
      const radii   = history.map((_, i) =>
        i === days - 1 ? C.riskTrendLastPointRadius : C.riskTrendPointRadius
      );
      return {
        label:            dataset.label || '',
        data:             history,
        borderColor:      dataset.color || '#FF8C42',
        backgroundColor:  dataset.color || '#FF8C42',
        borderWidth:      C.riskTrendLineWidth,
        pointRadius:      radii,
        pointHoverRadius: C.riskTrendLastPointRadius,
        tension:          C.riskTrendLineTension,
      };
    });

    const instance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: chartDatasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation: { duration: C.riskTrendAnimationMs, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            display:  config.showLegend ?? false,
            position: 'top',
            align:    'start',
            labels:   { color: C.riskTrendTickColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 },
          },
          tooltip:       { mode: 'index', intersect: false },
          datalabels:    { display: false },
          crosshairLine: {
            enabled:   config.crosshair ?? true,
            color:     C.riskTrendCrosshairColor,
            lineWidth: C.riskTrendCrosshairWidth,
            lineDash:  C.riskTrendCrosshairDash,
          },
        },
        scales: {
          x: {
            grid:   { display: false },
            ticks:  { color: C.riskTrendTickColor, font: { size: C.riskTrendTickFontSize } },
            border: { color: 'transparent' },
          },
          y: {
            min,
            max,
            position: 'right',
            grid: {
              display: true,
              color:   (context) => yGrids.includes(Math.round(context.tick.value)) ? C.riskTrendGridColor : 'transparent',
            },
            afterBuildTicks: (scale) => {
              scale.ticks = [...new Set([...yTicks, ...yGrids])]
                .filter(Number.isFinite)
                .sort((a, b) => a - b)
                .map((value) => ({ value }));
            },
            ticks: {
              color: C.riskTrendTickColor,
              font:  { size: C.riskTrendTickFontSize },
              callback: (value) => yTicks.includes(Math.round(value)) ? Math.round(value) : '',
            },
            border: { color: 'transparent' },
          },
        },
      },
    });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => instance.resize()).observe(canvas.parentElement || canvas);
    }

    return instance;
  },

  _buildSankey(el, config) {
    if (typeof d3 === 'undefined' || !d3.sankey) {
      let pollAttempts = 0;
      const pollInterval = setInterval(() => {
        pollAttempts++;
        if (typeof d3 !== 'undefined' && d3.sankey) {
          clearInterval(pollInterval);
          this._buildSankey(el, config);
        } else if (pollAttempts > 20) {
          clearInterval(pollInterval);
          console.error('[CardCharts] d3-sankey not loaded after 2s.');
        }
      }, 100);
      return null;
    }

    if (!config.flows?.length) {
      console.warn('[CardCharts] sankey: no flows');
      return null;
    }

    const C             = this.CONFIG;
    const sourceColor   = config.datasets?.[0]?.color || C.sankeyNodeColor;
    const nodeColors    = config.nodeColors    || {};
    const labelColor    = config.labelColor    || C.sankeyLabelColor;
    const subLabelColor = config.subLabelColor || 'rgba(150,150,150,0.8)';
    const nodeWidth     = config.nodeWidth     || C.sankeyNodeWidth;
    const nodePadding   = config.nodePadding   ?? 20;
    const nodeRadius    = config.nodeRadius    ?? 3;
    const linkOpacity   = config.linkOpacity   ?? C.sankeyLinkOpacity;
    const labelPadding  = config.labelPadding  ?? 8;
    const labelAlign    = config.labelAlign    || 'auto';
    const fontSize      = config.fontSize      || C.sankeyFontSize;
    const resolveColor  = (name) => nodeColors[name] || sourceColor;

    /**
     * Builds a filled S-curve band path between two nodes.
     * Uses d3-sankey layout values directly — does not rely on
     * d3.sankeyLinkHorizontal() which behaves differently across d3 versions.
     *
     * d3-sankey gives us per-link:
     *   link.y0     — vertical centre at the source node's right edge
     *   link.y1     — vertical centre at the target node's left edge
     *   link.width  — band thickness in pixels
     *   link.source.x1 — source right edge x
     *   link.target.x0 — target left edge x
     */
    const buildLinkPath = (link) => {
      const sx   = link.source.x1;
      const tx   = link.target.x0;
      const midX = (sx + tx) / 2;
      const halfW = link.width / 2;

      const sy0 = link.y0 - halfW;
      const sy1 = link.y0 + halfW;
      const ty0 = link.y1 - halfW;
      const ty1 = link.y1 + halfW;

      return [
        `M ${sx},${sy0}`,
        `C ${midX},${sy0} ${midX},${ty0} ${tx},${ty0}`,
        `L ${tx},${ty1}`,
        `C ${midX},${ty1} ${midX},${sy1} ${sx},${sy1}`,
        'Z',
      ].join(' ');
    };

    const render = () => {
      el.innerHTML = '';
      const width  = el.offsetWidth  || 600;
      const height = el.offsetHeight || 300;

      const leftPad  = config.leftPad  || config.labelWidth || 200;
      const rightPad = config.rightPad || config.labelWidth || 160;

      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = document.createElementNS(svgNS, 'svg');
      svgEl.setAttribute('width',    width);
      svgEl.setAttribute('height',   height);
      svgEl.setAttribute('overflow', 'visible');
      el.appendChild(svgEl);

      const layout = d3.sankey()
        .nodeWidth(nodeWidth)
        .nodePadding(nodePadding)
        .extent([[leftPad, 8], [width - rightPad, height - 8]]);

      const nodeNames = [...new Set(config.flows.flatMap((flow) => [flow.from, flow.to]))];
      const nodeIndex = Object.fromEntries(nodeNames.map((name, i) => [name, i]));

      const graph = layout({
        nodes: nodeNames.map((name) => ({ name, color: resolveColor(name) })),
        links: config.flows.map((flow) => ({
          source: nodeIndex[flow.from],
          target: nodeIndex[flow.to],
          value:  flow.value,
        })),
      });

      // ── Gradient defs ────────────────────────────────────────
      const defsEl = document.createElementNS(svgNS, 'defs');
      graph.links.forEach((link, i) => {
        const gradientId = `sg-${i}`;
        const gradEl     = document.createElementNS(svgNS, 'linearGradient');
        gradEl.setAttribute('id',            gradientId);
        gradEl.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradEl.setAttribute('x1',            link.source.x1);
        gradEl.setAttribute('y1',            0);
        gradEl.setAttribute('x2',            link.target.x0);
        gradEl.setAttribute('y2',            0);

        const stopStart = document.createElementNS(svgNS, 'stop');
        stopStart.setAttribute('offset',       '0%');
        stopStart.setAttribute('stop-color',   link.source.color);
        stopStart.setAttribute('stop-opacity', linkOpacity);

        const stopEnd = document.createElementNS(svgNS, 'stop');
        stopEnd.setAttribute('offset',       '100%');
        stopEnd.setAttribute('stop-color',   link.target.color);
        stopEnd.setAttribute('stop-opacity', linkOpacity);

        gradEl.appendChild(stopStart);
        gradEl.appendChild(stopEnd);
        defsEl.appendChild(gradEl);
        link.gradId = gradientId;
      });
      svgEl.appendChild(defsEl);

      // ── Links ────────────────────────────────────────────────
      const linkGroupEl = document.createElementNS(svgNS, 'g');
      graph.links.forEach((link) => {
        const pathEl = document.createElementNS(svgNS, 'path');
        pathEl.setAttribute('d',      buildLinkPath(link));
        pathEl.setAttribute('fill',   `url(#${link.gradId})`);
        pathEl.setAttribute('stroke', 'none');
        linkGroupEl.appendChild(pathEl);
      });
      svgEl.appendChild(linkGroupEl);

      // ── Nodes + labels ───────────────────────────────────────
      const midY = (node) => (node.y0 + node.y1) / 2;

      // labelAlign: 'auto' detects side by x position.
      // 'start' / 'center' / 'end' forces all labels to that alignment.
      const isAutoLeft = (node) => node.x0 < width / 2;
      const resolveLabelX = (node) => {
        if (labelAlign === 'center') return (node.x0 + node.x1) / 2;
        if (labelAlign === 'start')  return node.x1 + labelPadding;
        if (labelAlign === 'end')    return node.x0 - labelPadding;
        return isAutoLeft(node) ? node.x0 - labelPadding : node.x1 + labelPadding;
      };
      const resolveAnchor = (node) => {
        if (labelAlign === 'center') return 'middle';
        if (labelAlign === 'start')  return 'start';
        if (labelAlign === 'end')    return 'end';
        return isAutoLeft(node) ? 'end' : 'start';
      };
      const resolveIsLeft = (node) => {
        if (labelAlign === 'start')  return false;
        if (labelAlign === 'end')    return true;
        return isAutoLeft(node);
      };

      const nodeGroupEl = document.createElementNS(svgNS, 'g');
      graph.nodes.forEach((node) => {
        const rectEl = document.createElementNS(svgNS, 'rect');
        rectEl.setAttribute('x',      node.x0);
        rectEl.setAttribute('y',      node.y0);
        rectEl.setAttribute('width',  node.x1 - node.x0);
        rectEl.setAttribute('height', Math.max(1, node.y1 - node.y0));
        rectEl.setAttribute('fill',   node.color);
        rectEl.setAttribute('rx',     nodeRadius);
        nodeGroupEl.appendChild(rectEl);

        const nameEl = document.createElementNS(svgNS, 'text');
        nameEl.setAttribute('x',           resolveLabelX(node));
        nameEl.setAttribute('y',           midY(node) - fontSize * 0.6);
        nameEl.setAttribute('text-anchor', resolveAnchor(node));
        nameEl.setAttribute('fill',        labelColor);
        nameEl.setAttribute('font-size',   fontSize);
        nameEl.setAttribute('font-weight', '500');
        nameEl.textContent = node.name;
        nodeGroupEl.appendChild(nameEl);

        const subEl = document.createElementNS(svgNS, 'text');
        subEl.setAttribute('x',           resolveLabelX(node));
        subEl.setAttribute('y',           midY(node) + fontSize * 0.8);
        subEl.setAttribute('text-anchor', resolveAnchor(node));
        subEl.setAttribute('fill',        subLabelColor);
        subEl.setAttribute('font-size',   fontSize - 1);
        subEl.textContent = resolveIsLeft(node)
          ? `${node.value} ${node.value === 1 ? 'time' : 'times'}`
          : String(node.value);
        nodeGroupEl.appendChild(subEl);
      });
      svgEl.appendChild(nodeGroupEl);
    };

    render();

    if (typeof ResizeObserver !== 'undefined') {
      let resizeDebounceTimer;
      new ResizeObserver(() => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(() => {
          if (el.offsetWidth > 50) render();
        }, 150);
      }).observe(el);
    }

    return { el, type: 'sankey' };
  },

  _baseOptions() {
    return {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      plugins: {
        legend:     { display: false },
        tooltip:    { mode: 'index', intersect: false },
        datalabels: { display: false },
      },
    };
  },

  _postBuild(canvas, total, legendItems) {
    const scope = canvas.closest('[data-chart-canvas-wrap]') || canvas.parentElement;
    if (!scope) return;
    const valueEl = scope.querySelector('[data-chart-center-value]');
    if (valueEl) valueEl.textContent = total;
    this._buildLegend(scope, legendItems);
  },

  _resolveColor(ctx, chartArea, colorValue, canvas) {
    const preset = this.CONFIG.gradientPresets[colorValue];
    if (!preset) return colorValue;
    if (preset.direction === 'horizontal') {
      const x2 = chartArea ? chartArea.right : (canvas?.width  || 400);
      const x1 = chartArea ? chartArea.left  : 0;
      return this._buildGradient(ctx, x1, 0, x2, 0, preset.stops);
    }
    const y1 = chartArea ? chartArea.bottom : (canvas?.height || 200);
    const y2 = chartArea ? chartArea.top    : 0;
    return this._buildGradient(ctx, 0, y1, 0, y2, preset.stops);
  },

  _buildReferenceLabelPlugin(refLines, refLabels) {
    const C = this.CONFIG;
    return {
      id: 'referenceLabelPlugin',
      afterDraw(chart) {
        if (!refLines.length) return;
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        refLines.forEach((value, i) => {
          if (!refLabels[i]) return;
          const yPos = scales.y.getPixelForValue(value);
          const fs   = C.lineReferenceLabelFontSize;
          const padX = C.lineReferenceLabelPadX;
          const padY = C.lineReferenceLabelPadY;
          ctx.save();
          ctx.font = `600 ${fs}px sans-serif`;
          const textWidth  = ctx.measureText(refLabels[i]).width;
          const pillWidth  = textWidth + padX * 2;
          const pillHeight = fs + padY * 2;
          const pillX      = chartArea.right - pillWidth;
          const pillY      = yPos - pillHeight / 2;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 4);
          ctx.fillStyle = C.lineReferenceLabelBg;
          ctx.fill();
          ctx.fillStyle    = C.lineReferenceLabelColor;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(refLabels[i], pillX + pillWidth / 2, yPos);
          ctx.restore();
        });
      },
    };
  },

  _buildGradient(ctx, x1, y1, x2, y2, stops) {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(({ position, color }) => gradient.addColorStop(position, color));
    return gradient;
  },

  _buildBarGradient(chartInstance, colorValue) {
    const { ctx, chartArea } = chartInstance;
    if (!chartArea) return null;
    return this._resolveColor(ctx, chartArea, colorValue);
  },

  _buildDotGridPoints(total, columns, rows) {
    const points = [];
    for (let i = 0; i < total; i++) {
      points.push({
        x: i % columns,
        y: (rows - 1) - Math.floor(i / columns),
        r: this.CONFIG.dotRadius,
      });
    }
    return points;
  },

  _colorWithOpacity(hex, opacity) {
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6) return hex;
    return `rgba(${parseInt(cleaned.slice(0, 2), 16)},${parseInt(cleaned.slice(2, 4), 16)},${parseInt(cleaned.slice(4, 6), 16)},${opacity})`;
  },

  _parseConfig(canvas) {
    if (!canvas.dataset.config) return {};
    try {
      return JSON.parse(canvas.dataset.config);
    } catch (err) {
      console.warn('[CardCharts] Invalid data-config JSON:', err);
      return {};
    }
  },

  _createEl(tag, attr, text) {
    const newEl = document.createElement(tag);
    newEl.setAttribute(attr, '');
    if (text !== undefined) newEl.textContent = text;
    return newEl;
  },

  _resolveValues(dataset, count) {
    if (dataset.values?.length) return dataset.values;
    if (dataset.mock) {
      const end  = dataset.score    ?? 50;
      const min  = dataset.min      ?? 0;
      const max  = dataset.max      ?? 100;
      const n    = dataset.count    ?? count ?? this.CONFIG.riskTrendDays;
      const step = dataset.stepSize ?? this.CONFIG.riskTrendRandomStep;
      const pull = dataset.anchorPull ?? this.CONFIG.riskTrendAnchorPull;
      return this._generateMockData(end, min, max, n, step, pull);
    }
    return [];
  },

  _generateMockData(endValue, min, max, count, stepSize, anchorPull) {
    const steps  = count    ?? this.CONFIG.riskTrendDays;
    const step   = stepSize ?? this.CONFIG.riskTrendRandomStep;
    const pull   = anchorPull ?? this.CONFIG.riskTrendAnchorPull;
    const data   = new Array(steps).fill(endValue);
    let   cursor = endValue;

    for (let i = steps - 2; i >= 0; i--) {
      const next = cursor + (Math.random() - 0.5) * 2 * step + (endValue - cursor) * pull;
      cursor     = Number.isFinite(next) ? Math.min(Math.max(next, min), max) : endValue;
      data[i]    = Math.round(cursor);
    }

    return data.map((value) => Number.isFinite(value) ? value : endValue);
  },

  _registerCrosshairPlugin() {
    if (Chart.registry.plugins.get('crosshairLine')) return;
    Chart.register({
      id: 'crosshairLine',
      afterDraw(chart) {
        const opts = chart.options.plugins.crosshairLine;
        if (!opts?.enabled) return;
        const activeElements = chart.tooltip?._active;
        if (!activeElements?.length) return;
        const { ctx, chartArea } = chart;
        ctx.save();
        ctx.beginPath();
        ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(activeElements[0].element.x, chartArea.top);
        ctx.lineTo(activeElements[0].element.x, chartArea.bottom);
        ctx.lineWidth   = opts.lineWidth;
        ctx.strokeStyle = opts.color;
        ctx.setLineDash(opts.lineDash || []);
        ctx.stroke();
        ctx.restore();
      },
    });
  },

  _registerSuppressNaNPlugin() {
    if (Chart.registry.plugins.get('suppressNaN')) return;
    Chart.register({
      id: 'suppressNaN',
      beforeInit(chart) {
        const origFillText = chart.ctx.fillText.bind(chart.ctx);
        chart.ctx.fillText = (text, ...args) => {
          if (String(text).trim() === 'NaN') return;
          origFillText(text, ...args);
        };
      },
    });
  },

  _buildLegend(scope, items) {
    const legendEl = scope?.querySelector('[data-chart-legend]');
    if (!legendEl || !items.some((item) => item.label)) return;

    legendEl.innerHTML = '';
    items.forEach((item) => {
      if (!item.label) return;

      const dotEl = this._createEl('span', 'data-legend-dot');
      dotEl.style.setProperty('--dot-color', item.color);

      const valuesEl = this._createEl('span', 'data-legend-values');
      valuesEl.append(
        this._createEl('span', 'data-legend-value',   item.value),
        this._createEl('span', 'data-legend-percent', `${item.percentage}%`),
      );

      const textEl = this._createEl('span', 'data-legend-text');
      textEl.append(
        this._createEl('span', 'data-legend-label', item.label),
        valuesEl,
      );

      const itemEl = this._createEl('div', 'data-legend-item');
      itemEl.append(dotEl, textEl);
      legendEl.appendChild(itemEl);
    });
  },

};

CardCharts.init();
