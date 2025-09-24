// Dynamically load Chart.js from CDN
(function() {
    const chartJsScript = document.createElement('script');
    chartJsScript.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
    document.head.appendChild(chartJsScript);
})();

const css = `
    .ts-agg-viz-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px;
        box-sizing: border-box;
        background-color: #fff;
    }
    .ts-agg-value-container {
        padding: 15px;
        margin-bottom: 15px;
        text-align: center;
        border-bottom: 1px solid #eee;
        flex-shrink: 0;
    }
    .ts-agg-title {
        font-size: 14px;
        color: #777;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .ts-agg-value {
        font-size: 48px;
        font-weight: 300;
        color: #1f77b4;
        margin-top: 5px;
        line-height: 1.2;
    }
    .ts-chart-container {
        flex-grow: 1;
        position: relative;
        min-height: 0;
    }
`;

// Helper functions for data aggregation
function sum(data) {
    return data.reduce((a, b) => a + b, 0);
}

function avg(data) {
    const s = sum(data);
    return data.length ? s / data.length : 0;
}

function median(data) {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}

function min(data) {
    return data.length ? Math.min(...data) : 0;
}

function max(data) {
    return data.length ? Math.max(...data) : 0;
}

const aggregationFunctions = {
    sum: sum,
    avg: avg,
    median: median,
    min: min,
    max: max
};

// Global reference for Chart.js instance to update it
let chartInstance = null;

const vis = {
    // --- Visualization Options ---
    options: {
        selected_measure_field: {
            type: "string",
            label: "Measure for Aggregation",
            display: "select",
            default: "auto",
            section: "Aggregation Settings",
            order: 1,
            // Looker will dynamically populate values via updateAsync's `updateConfig`
            values: []
        },
        selected_aggregation: {
            type: "string",
            label: "Aggregation Function",
            display: "select",
            default: "avg",
            section: "Aggregation Settings",
            order: 2,
            values: [
                { "Average": "avg" },
                { "Sum": "sum" },
                { "Median": "median" },
                { "Minimum": "min" },
                { "Maximum": "max" },
            ]
        },
        chart_color: {
            type: "string",
            label: "Chart Line Color",
            display: "color",
            default: "#1F77B4",
            section: "Chart Settings",
            order: 3,
        },
        aggregation_value_format: {
            type: "string",
            label: "Aggregated Value Format (Looker Format String)",
            display: "text",
            default: "#,##0.00",
            section: "Aggregation Settings",
            order: 4,
        }
    },

    // --- Visualization Creation ---
    create: function(element) {
        // Inject inline CSS
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);

        // Build the DOM structure for the visualization
        element.innerHTML = `
            <div class="ts-agg-viz-container">
                <div id="ts-agg-value-container" class="ts-agg-value-container">
                    <div id="ts-agg-title" class="ts-agg-title"></div>
                    <div id="ts-agg-value" class="ts-agg-value"></div>
                </div>
                <div class="ts-chart-container">
                    <canvas id="timeseries-chart"></canvas>
                </div>
            </div>
        `;
    },

    // --- Visualization Update (Main Logic) ---
    updateAsync: function(data, element, config, queryResponse, details, done) {
        this.clearErrors();

        // Log the initial data and queryResponse objects
        console.log("Looker Data:", data);
        console.log("Query Response:", queryResponse);

        // Check for required fields and Chart.js availability
        const { fields } = queryResponse;
        if (!fields || fields.dimension_like.length < 1 || fields.measure_like.length < 1) {
            this.addError({
                title: 'Data Error',
                message: 'Please include at least one dimension (time) and one measure.'
            });
            done();
            return;
        }

        if (typeof Chart === 'undefined') {
            this.addError({
                title: 'Library Missing',
                message: 'Chart.js library is not loaded. Please ensure it is included.'
            });
            done();
            return;
        }

        const dimensions = fields.dimension_like;
        const measures = fields.measure_like;
        const timeDimField = dimensions[0];
        const firstMeasureField = measures[0];

        // 1. Dynamic Viz Options Update (Measure Select)
        const availableMeasures = measures.map(m => ({ [m.label]: m.name }));
        const newMeasureConfig = {
            selected_measure_field: {
                values: availableMeasures,
                default: firstMeasureField.name
            }
        };
        this.trigger('updateConfig', newMeasureConfig);

        // Determine the measure for aggregation/chart data
        const selectedMeasureName = config.selected_measure_field || firstMeasureField.name;
        const selectedMeasure = measures.find(m => m.name === selectedMeasureName);
        const selectedAggregation = config.selected_aggregation || 'avg';
        const chartColor = config.chart_color || '#1F77B4';
        const valueFormat = config.aggregation_value_format || "#,##0.00";

        // --- Data Processing for Aggregation ---
        const valuesForAggregation = data.map(row => {
            const fieldData = row[selectedMeasureName];
            return (fieldData && !isNaN(parseFloat(fieldData.value))) ? parseFloat(fieldData.value) : 0;
        });

        const aggregateFn = aggregationFunctions[selectedAggregation];
        const aggregatedValue = aggregateFn ? aggregateFn(valuesForAggregation) : 0;

        // Format the aggregated value using Looker's utility if available
        let formattedAggValue = aggregatedValue.toFixed(2);
        if (window.LookerCharts && window.LookerCharts.Utils && window.LookerCharts.Utils.formatValue) {
            const formatString = valueFormat || (selectedMeasure && selectedMeasure.value_format);
            formattedAggValue = window.LookerCharts.Utils.formatValue(aggregatedValue, formatString);
        } else {
            formattedAggValue = aggregatedValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
        }

        // --- Update Aggregation Display ---
        document.getElementById('ts-agg-title').textContent = `${selectedAggregation.toUpperCase()} OF ${selectedMeasure ? selectedMeasure.label : 'VALUE'}`;
        document.getElementById('ts-agg-value').textContent = formattedAggValue;

        // --- Data Processing for Time Series Chart ---
        const chartData = {
            labels: data.map(row => row[timeDimField.name].rendered || row[timeDimField.name].value),
            datasets: [{
                label: firstMeasureField.label,
                data: data.map(row => row[firstMeasureField.name].value),
                borderColor: chartColor,
                backgroundColor: 'rgba(0,0,0,0)',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: chartColor
            }]
        };

        // --- Chart Rendering (Chart.js) ---
        const ctx = document.getElementById('timeseries-chart').getContext('2d');
        if (chartInstance) {
            chartInstance.data = chartData;
            chartInstance.options.scales.y.title.text = firstMeasureField.label;
            chartInstance.options.scales.x.title.text = timeDimField.label;
            chartInstance.update();
        } else {
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: true, position: 'top' },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        x: {
                            type: 'category',
                            title: { display: true, text: timeDimField.label, color: '#555' },
                            ticks: { maxRotation: 45, minRotation: 0 }
                        },
                        y: {
                            beginAtZero: false,
                            title: { display: true, text: firstMeasureField.label, color: '#555' }
                        }
                    }
                }
            });
        }
        done();
    }
};

// Register the visualization with Looker
looker.plugins.visualizations.add(vis);
