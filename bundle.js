(function() {
    // Ensure LookerVisualization base class exists (assumed to be loaded by Looker)
    if (typeof LookerVisualization === 'undefined') {
        console.error("LookerVisualization base class is not defined. Ensure your environment is correct.");
        return;
    }

    // --- Utility Functions (Aggregation) ---

    /**
     * Extracts numeric values from a Looker data array for a specific measure.
     * @param {Array<Object>} data - The raw Looker data array of rows.
     * @param {string} measureName - The name of the measure field.
     * @returns {Array<number>} An array of numeric values.
     */
    function extractMeasureValues(data, measureName) {
        return data.map(row => {
            const fieldData = row[measureName];
            const value = fieldData && fieldData.value;
            // Handle nulls and ensure numeric conversion
            return (value !== null && !isNaN(parseFloat(value))) ? parseFloat(value) : 0;
        });
    }

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

    // --- Main Visualization Class ---

    class TimeSeriesAggregator extends LookerVisualization {
        constructor(element) {
            super(element);
            this.chart = null; // To hold the Chart.js instance

            // Setup DOM structure with inline CSS
            this.container = element;
            this.container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; display: flex; flex-direction: column; height: 100%; padding: 10px; box-sizing: border-box; background-color: #fff;';

            // 1. Aggregation Value Display Area
            this.aggContainer = document.createElement('div');
            this.aggContainer.style.cssText = 'padding: 15px; margin-bottom: 15px; text-align: center; border-bottom: 1px solid #eee; flex-shrink: 0;';
            this.container.appendChild(this.aggContainer);

            this.aggTitle = document.createElement('div');
            this.aggTitle.style.cssText = 'font-size: 14px; color: #777; text-transform: uppercase; letter-spacing: 0.5px;';
            this.aggContainer.appendChild(this.aggTitle);

            this.aggValue = document.createElement('div');
            this.aggValue.style.cssText = 'font-size: 48px; font-weight: 300; color: #1f77b4; margin-top: 5px; line-height: 1.2;';
            this.aggContainer.appendChild(this.aggValue);

            // 2. Chart Area
            this.chartContainer = document.createElement('div');
            this.chartContainer.style.cssText = 'flex-grow: 1; position: relative; min-height: 0;'; // min-height: 0 required for flex-grow to work properly in some containers
            this.container.appendChild(this.chartContainer);

            this.canvas = document.createElement('canvas');
            this.canvas.id = 'timeseries-chart';
            this.chartContainer.appendChild(this.canvas);
        }

        getVisualizationOptions() {
            // Static options definition. Dynamic measure list is updated in `update`.
            return {
                selected_measure_field: {
                    type: "string",
                    label: "Measure for Aggregation",
                    display: "select",
                    default: "auto", // 'auto' tells update() to select the first measure
                    section: "Aggregation Settings",
                    order: 1,
                    // Looker will overwrite this with actual measures if `updateConfig` is used.
                    values: [{ "First Measure (Auto)": "auto" }]
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
            };
        }

        update(data, metadata, config, queryResponse) {
            // Error handling and field checks
            if (!this.handleErrors(data, queryResponse)) {
                return;
            }

            const { fields } = queryResponse;
            const dimensions = fields.dimension_like;
            const measures = fields.measure_like;

            const timeDimField = dimensions[0];
            const firstMeasureField = measures[0];

            // 1. Dynamic Viz Options Update (Measure Select)
            // This ensures the dropdown options reflect the actual measures in the query.
            const availableMeasures = measures.map(m => ({ [m.label]: m.name }));
            const newMeasureConfig = {
                selected_measure_field: {
                    values: availableMeasures,
                    default: firstMeasureField.name
                }
            };
            this.updateConfig(newMeasureConfig);

            // Determine the measure for aggregation/chart data
            let selectedMeasureName = config.selected_measure_field;
            // Fall back to first measure if 'auto' or selected measure is missing
            if (selectedMeasureName === 'auto' || !measures.find(m => m.name === selectedMeasureName)) {
                selectedMeasureName = firstMeasureField.name;
            }

            const selectedMeasure = measures.find(m => m.name === selectedMeasureName);
            const selectedAggregation = config.selected_aggregation || 'avg';
            const chartColor = config.chart_color || '#1F77B4';
            const valueFormat = config.aggregation_value_format || "#,##0.00";

            // --- Data Processing for Aggregation ---
            const valuesForAggregation = extractMeasureValues(data, selectedMeasureName);
            const aggregateFn = aggregationFunctions[selectedAggregation];
            const aggregatedValue = aggregateFn ? aggregateFn(valuesForAggregation) : 0;

            // Format the aggregated value using Looker's utility if available
            let formattedAggValue = aggregatedValue.toFixed(2);
            if (window.LookerCharts && window.LookerCharts.Utils && window.LookerCharts.Utils.formatValue) {
                // Use the configured format string and the selected measure's format if present
                const formatString = valueFormat || (selectedMeasure && selectedMeasure.value_format);
                formattedAggValue = window.LookerCharts.Utils.formatValue(aggregatedValue, formatString);
            } else {
                formattedAggValue = aggregatedValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
            }

            // --- Update Aggregation Display ---
            this.aggTitle.textContent = `${selectedAggregation.toUpperCase()} OF ${selectedMeasure ? selectedMeasure.label : 'VALUE'}`;
            this.aggValue.textContent = formattedAggValue;

            // --- Data Processing for Time Series Chart ---
            const chartData = {
                // X-axis labels use the first dimension's rendered or raw value
                labels: data.map(row => row[timeDimField.name].rendered || row[timeDimField.name].value),
                datasets: [{
                    label: firstMeasureField.label,
                    // Y-axis data uses the first measure's raw value
                    data: data.map(row => row[firstMeasureField.name].value),
                    borderColor: chartColor,
                    backgroundColor: 'rgba(0,0,0,0)', // Transparent fill for line
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3, // Soft curve for the line
                    pointRadius: 3,
                    pointBackgroundColor: chartColor
                }]
            };

            // --- Chart Rendering (Chart.js) ---
            const ctx = this.canvas.getContext('2d');

            if (this.chart) {
                // Update existing chart instance
                this.chart.data = chartData;
                this.chart.options.scales.y.title.text = firstMeasureField.label;
                this.chart.options.scales.x.title.text = timeDimField.label;
                this.chart.update();
            } else {
                // Create new chart instance
                this.chart = new Chart(ctx, {
                    type: 'line',
                    data: chartData,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                            }
                        },
                        scales: {
                            x: {
                                type: 'category',
                                title: {
                                    display: true,
                                    text: timeDimField.label,
                                    color: '#555'
                                },
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 0
                                }
                            },
                            y: {
                                beginAtZero: false,
                                title: {
                                    display: true,
                                    text: firstMeasureField.label,
                                    color: '#555'
                                }
                            }
                        }
                    }
                });
            }
        }

        handleErrors(data, queryResponse) {
            this.container.innerHTML = ''; // Clear previous errors

            // 1. Chart.js check
            if (typeof Chart === 'undefined') {
                this.container.innerHTML = '<div style="color: red; padding: 10px; font-weight: bold;">Chart.js library not loaded. Please ensure Chart.js is included in your Custom Visualization HTML.</div>';
                return false;
            }

            // 2. Data/Fields check
            if (!queryResponse || !queryResponse.fields) {
                this.container.innerHTML = '<div style="color: red; padding: 10px;">Invalid query response structure.</div>';
                return false;
            }

            const dimensions = queryResponse.fields.dimension_like;
            const measures = queryResponse.fields.measure_like;

            if (dimensions.length < 1) {
                this.container.innerHTML = '<div style="color: red; padding: 10px;">**Query Error:** Please include at least one dimension (typically a time field).</div>';
                return false;
            }
            if (measures.length < 1) {
                this.container.innerHTML = '<div style="color: red; padding: 10px;">**Query Error:** Please include at least one measure.</div>';
                return false;
            }

            return true;
        }
    }

    // Register the visualization with Looker
    looker.plugins.visualizations.add(new TimeSeriesAggregator(document.getElementById('visualization')));
})();
