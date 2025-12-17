export class ChartRenderer {
    constructor(ctxId) {
        this.ctx = document.getElementById(ctxId).getContext('2d');
        this.chart = null;
    }

    render(cycle, analysis) {
        if (!cycle || !cycle.entries || cycle.entries.length === 0) {
            if (this.chart) this.chart.destroy();
            this.chart = null;
            return;
        }

        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Labels : jour du cycle (1, 2, 3...) + date calendrier
        const startDate = new Date(cycle.startDate);
        const labels = entries.map(e => {
            const date = new Date(e.date);
            const dayNumber = Math.floor((date - startDate) / (1000 * 60 * 60 * 24)) + 1;
            return `${dayNumber} (${date.getDate()}/${date.getMonth() + 1})`;
        });

        const tempData = entries.map(e => e.excludeTemp ? null : e.temp);

        const annotations = {};

        if (analysis && analysis.coverLine) {
            annotations.coverLine = {
                type: 'line',
                yMin: analysis.coverLine,
                yMax: analysis.coverLine,
                borderColor: '#00bfa5',
                borderWidth: 2,
                label: {
                    content: 'Ligne de base',
                    enabled: true,
                    position: 'start'
                }
            };
        }

        if (analysis && analysis.peakDayIndex !== null && analysis.peakDayIndex < entries.length) {
            annotations.peakDay = {
                type: 'line',
                xMin: analysis.peakDayIndex,
                xMax: analysis.peakDayIndex,
                borderColor: '#ff4081',
                borderWidth: 3,
                borderDash: [6, 6],
                label: {
                    content: 'JS (Pic)',
                    enabled: true,
                    backgroundColor: '#ff4081',
                    color: 'white'
                }
            };
        }

        const backgroundZones = [];

        if (analysis && analysis.postOvulatoryInfertileStartIndex !== null) {
            const infertileStart = analysis.postOvulatoryInfertileStartIndex;

            backgroundZones.push({
                from: 0,
                to: infertileStart,
                color: 'rgba(33, 150, 243, 0.2)'
            });

            backgroundZones.push({
                from: infertileStart,
                to: entries.length,
                color: 'rgba(255, 235, 59, 0.3)'
            });
        } else {
            backgroundZones.push({
                from: 0,
                to: entries.length - 1,
                color: 'rgba(33, 150, 243, 0.2)'
            });
        }

        const pointRadius = entries.map((e, i) => {
            if (analysis && analysis.highTempIndices && analysis.highTempIndices.includes(i)) {
                return 8;
            }
            return 5;
        });

        const pointBackgroundColor = entries.map((e, i) => {
            if (analysis && analysis.highTempIndices && analysis.highTempIndices.includes(i)) {
                return '#ff5722';
            }
            return '#6200ea';
        });

        const config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Température',
                    data: tempData,
                    borderColor: '#6200ea',
                    backgroundColor: 'rgba(98, 0, 234, 0.1)',
                    tension: 0.2,
                    pointRadius: pointRadius,
                    pointHoverRadius: pointRadius.map(r => r + 3),
                    pointBackgroundColor: pointBackgroundColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Cycle #${cycle.id} – Début : ${cycle.startDate}`,
                        color: 'var(--text-main)',
                        font: { size: 14 }
                    },
                    annotation: {
                        annotations: annotations
                    },
                    backgroundZones: {
                        zones: backgroundZones
                    }
                },
                scales: {
                    y: {
                        min: 35.8,
                        max: 37.5,
                        title: { display: true, text: '°C' },
                        ticks: { stepSize: 0.1 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true
                        }
                    }
                }
            },
            plugins: [{
                id: 'backgroundZones',
                beforeDatasetsDraw(chart) {
                    const { ctx, chartArea: { left, right, top, bottom }, scales: { x } } = chart;
                    const zones = chart.options.plugins.backgroundZones.zones || [];

                    zones.forEach(zone => {
                        const xStart = x.getPixelForValue(zone.from);
                        const xEnd = x.getPixelForValue(zone.to);

                        ctx.save();
                        ctx.fillStyle = zone.color;
                        ctx.fillRect(xStart, top, xEnd - xStart, bottom - top);
                        ctx.restore();
                    });
                }
            }]
        };

        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.ctx, config);
    }
}