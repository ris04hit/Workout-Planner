// =========================
// ANALYTICS UI COMPONENTS
// =========================

import { getWorkoutAnalytics, getAnalyticsSummary } from './analytics.js';
import { state } from './state.js';

/**
 * Render analytics dashboard
 */
export async function renderAnalyticsDashboard(timeframe = '30days') {
  const container = document.getElementById('analytics-dashboard');
  if (!container) return;

  try {
    const analytics = await getWorkoutAnalytics(timeframe);
    const summary = getAnalyticsSummary(analytics);
    
    container.innerHTML = `
      <div class="analytics-header">
        <h2>Workout Analytics</h2>
        <div class="timeframe-selector">
          <select id="analytics-timeframe" onchange="updateAnalyticsTimeframe(this.value)">
            <option value="7days" ${timeframe === '7days' ? 'selected' : ''}>Last 7 Days</option>
            <option value="30days" ${timeframe === '30days' ? 'selected' : ''}>Last 30 Days</option>
            <option value="90days" ${timeframe === '90days' ? 'selected' : ''}>Last 90 Days</option>
            <option value="1year" ${timeframe === '1year' ? 'selected' : ''}>Last Year</option>
          </select>
        </div>
      </div>
      
      <div class="analytics-summary">
        ${renderAnalyticsSummary(summary, analytics)}
      </div>
      
      <div class="analytics-charts">
        <div class="chart-container">
          <h3>Volume Progression</h3>
          <div id="volume-chart" class="chart"></div>
        </div>
        
        <div class="chart-container">
          <h3>Group Frequency</h3>
          <div id="frequency-chart" class="chart"></div>
        </div>
        
        <div class="chart-container">
          <h3>Strength Progress</h3>
          <div id="strength-chart" class="chart"></div>
        </div>
      </div>
      
      <div class="analytics-details">
        <div class="detail-section">
          <h3>Exercise Performance</h3>
          <div id="exercise-details"></div>
        </div>
        
        <div class="detail-section">
          <h3>Training Patterns</h3>
          <div id="patterns-details"></div>
        </div>
      </div>
    `;
    
    // Render charts and details
    renderVolumeChart(analytics.volumeProgression);
    renderFrequencyChart(analytics.groupAnalytics);
    renderStrengthChart(analytics.strengthProgress);
    renderExerciseDetails(analytics.exerciseAnalytics);
    renderTrainingPatterns(analytics.frequencyAnalysis);
    
  } catch (error) {
    container.innerHTML = '<p class="error">Failed to load analytics. Please try again.</p>';
  }
}

/**
 * Render analytics summary cards
 */
function renderAnalyticsSummary(summary, analytics) {
  const volumeTrendIcon = getTrendIcon(summary.volumeTrend);
  const volumeTrendClass = getTrendClass(summary.volumeTrend);
  
  return `
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-value">${summary.totalWorkouts}</div>
        <div class="card-label">Total Workouts</div>
        <div class="card-period">${analytics.dateRange.start} to ${analytics.dateRange.end}</div>
      </div>
      
      <div class="summary-card">
        <div class="card-value">${summary.avgWorkoutsPerWeek.toFixed(1)}</div>
        <div class="card-label">Avg Workouts/Week</div>
        <div class="card-period">Based on ${analytics.totalWorkouts} workouts</div>
      </div>
      
      <div class="summary-card">
        <div class="card-value">${summary.mostTrainedGroup}</div>
        <div class="card-label">Most Trained Group</div>
        <div class="card-period">Primary focus area</div>
      </div>
      
      <div class="summary-card">
        <div class="card-value">${Math.round(summary.totalVolume).toLocaleString()}</div>
        <div class="card-label">Total Volume</div>
        <div class="card-period">kg × reps</div>
      </div>
      
      <div class="summary-card ${volumeTrendClass}">
        <div class="card-value">${volumeTrendIcon} ${Math.round(summary.avgVolumePerWorkout)}</div>
        <div class="card-label">Avg Volume/Workout</div>
        <div class="card-period">${summary.volumeTrend} trend</div>
      </div>
    </div>
  `;
}

/**
 * Render volume progression chart
 */
function renderVolumeChart(volumeData) {
  const container = document.getElementById('volume-chart');
  if (!container || volumeData.length === 0) {
    container.innerHTML = '<p class="no-data">No volume data available</p>';
    return;
  }
  
  const maxVolume = Math.max(...volumeData.map(d => d.volume));
  const chartHeight = 200;
  const chartWidth = container.offsetWidth || 600;
  const padding = 40;
  
  // Create simple bar chart using CSS
  const bars = volumeData.map((data, index) => {
    const height = (data.volume / maxVolume) * (chartHeight - padding);
    const left = (index / volumeData.length) * (chartWidth - padding) + padding;
    
    return `
      <div class="chart-bar" 
           style="height: ${height}px; left: ${left}px; bottom: ${padding}px;"
           title="${data.date}: ${Math.round(data.volume)} volume">
        <div class="bar-value">${Math.round(data.volume)}</div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="simple-chart" style="height: ${chartHeight}px; position: relative;">
      ${bars}
      <div class="chart-axis" style="bottom: ${padding}px; left: ${padding}px; right: 0;"></div>
    </div>
    <div class="chart-legend">
      <span>Daily training volume (kg × reps)</span>
    </div>
  `;
}

/**
 * Render group frequency chart
 */
function renderFrequencyChart(groupAnalytics) {
  const container = document.getElementById('frequency-chart');
  if (!container || Object.keys(groupAnalytics).length === 0) {
    container.innerHTML = '<p class="no-data">No frequency data available</p>';
    return;
  }
  
  const groups = Object.entries(groupAnalytics)
    .sort((a, b) => b[1].count - a[1].count);
  
  const maxCount = Math.max(...groups.map(g => g[1].count));
  const chartHeight = 200;
  
  const bars = groups.map(([group, stats], index) => {
    const height = (stats.count / maxCount) * (chartHeight - 40);
    
    return `
      <div class="frequency-bar">
        <div class="bar-label">${group}</div>
        <div class="bar-container">
          <div class="bar" style="height: ${height}px;" title="${group}: ${stats.count} workouts">
            <div class="bar-value">${stats.count}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="frequency-chart">
      ${bars}
    </div>
    <div class="chart-legend">
      <span>Number of workouts per movement pattern</span>
    </div>
  `;
}

/**
 * Render strength progress chart
 */
function renderStrengthChart(strengthProgress) {
  const container = document.getElementById('strength-chart');
  const topExercises = Object.entries(strengthProgress)
    .filter(([name, stats]) => stats.strengthProgress > 0)
    .sort((a, b) => b[1].strengthProgress - a[1].strengthProgress)
    .slice(0, 5);
  
  if (!container || topExercises.length === 0) {
    container.innerHTML = '<p class="no-data">No strength progress data available</p>';
    return;
  }
  
  const progressItems = topExercises.map(([name, stats]) => {
    const progressClass = stats.strengthProgress > 20 ? 'excellent' : 
                         stats.strengthProgress > 10 ? 'good' : 'moderate';
    
    return `
      <div class="strength-progress-item">
        <div class="exercise-name">${name}</div>
        <div class="progress-bar">
          <div class="progress-fill ${progressClass}" 
               style="width: ${Math.min(stats.strengthProgress, 100)}%">
            ${stats.strengthProgress.toFixed(1)}%
          </div>
        </div>
        <div class="progress-details">
          ${stats.weight.toFixed(1)}kg → ${stats.dataPoints[stats.dataPoints.length - 1].weight.toFixed(1)}kg
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="strength-progress-list">
      ${progressItems}
    </div>
    <div class="chart-legend">
      <span>Top strength gains (estimated 1RM improvement)</span>
    </div>
  `;
}

/**
 * Render exercise details table
 */
function renderExerciseDetails(exerciseAnalytics) {
  const container = document.getElementById('exercise-details');
  if (!container) return;
  
  const topExercises = Object.entries(exerciseAnalytics)
    .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
    .slice(0, 10);
  
  if (topExercises.length === 0) {
    container.innerHTML = '<p class="no-data">No exercise data available</p>';
    return;
  }
  
  const rows = topExercises.map(([name, stats]) => {
    const trendIcon = getTrendIcon(stats.progressionTrend);
    const trendClass = getTrendClass(stats.progressionTrend);
    
    return `
      <tr>
        <td class="exercise-name">${name}</td>
        <td class="exercise-group">${stats.group}</td>
        <td class="exercise-sessions">${stats.count}</td>
        <td class="exercise-volume">${Math.round(stats.totalVolume).toLocaleString()}</td>
        <td class="exercise-best">${stats.bestWeight.toFixed(1)}kg</td>
        <td class="exercise-trend ${trendClass}">${trendIcon} ${stats.progressionTrend}</td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <table class="analytics-table">
      <thead>
        <tr>
          <th>Exercise</th>
          <th>Group</th>
          <th>Sessions</th>
          <th>Total Volume</th>
          <th>Best Weight</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/**
 * Render training patterns
 */
function renderTrainingPatterns(frequencyAnalysis) {
  const container = document.getElementById('patterns-details');
  if (!container) return;
  
  const { weeklyFrequency, dayOfWeekPattern, avgWorkoutsPerWeek } = frequencyAnalysis;
  
  // Day of week pattern
  const dayBars = dayOfWeekPattern.map(day => {
    const percentage = avgWorkoutsPerWeek > 0 ? (day.count / (avgWorkoutsPerWeek * 4)) * 100 : 0;
    return `
      <div class="day-pattern-bar">
        <div class="day-label">${day.name.substring(0, 3)}</div>
        <div class="day-bar">
          <div class="day-fill" style="height: ${percentage}%"></div>
        </div>
        <div class="day-count">${day.count}</div>
      </div>
    `;
  }).join('');
  
  // Weekly consistency
  const consistencyScore = calculateConsistencyScore(weeklyFrequency);
  const consistencyClass = consistencyScore > 80 ? 'excellent' : 
                          consistencyScore > 60 ? 'good' : 'needs-improvement';
  
  container.innerHTML = `
    <div class="patterns-content">
      <div class="pattern-section">
        <h4>Training Consistency</h4>
        <div class="consistency-score">
          <div class="score-circle ${consistencyClass}">
            ${consistencyScore}%
          </div>
          <div class="score-label">Consistency Score</div>
        </div>
      </div>
      
      <div class="pattern-section">
        <h4>Day of Week Pattern</h4>
        <div class="day-pattern-chart">
          ${dayBars}
        </div>
      </div>
      
      <div class="pattern-section">
        <h4>Weekly Average</h4>
        <div class="weekly-stats">
          <div class="stat-item">
            <div class="stat-value">${avgWorkoutsPerWeek.toFixed(1)}</div>
            <div class="stat-label">Workouts/Week</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${weeklyFrequency.length}</div>
            <div class="stat-label">Active Weeks</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Helper functions
 */
function getTrendIcon(trend) {
  switch (trend) {
    case 'increasing': return '📈';
    case 'decreasing': return '📉';
    case 'stable': return '➡️';
    default: return '❓';
  }
}

function getTrendClass(trend) {
  switch (trend) {
    case 'increasing': return 'trend-up';
    case 'decreasing': return 'trend-down';
    case 'stable': return 'trend-stable';
    default: return 'trend-unknown';
  }
}

function calculateConsistencyScore(weeklyFrequency) {
  if (weeklyFrequency.length === 0) return 0;
  
  const targetWorkoutsPerWeek = 3; // Could be configurable
  const totalWorkouts = weeklyFrequency.reduce((sum, week) => sum + week.workouts, 0);
  const expectedWorkouts = weeklyFrequency.length * targetWorkoutsPerWeek;
  
  return Math.min(100, Math.round((totalWorkouts / expectedWorkouts) * 100));
}

/**
 * Update analytics timeframe
 */
window.updateAnalyticsTimeframe = async function(timeframe) {
  await renderAnalyticsDashboard(timeframe);
};

/**
 * Export analytics data
 */
export async function exportAnalyticsData(format = 'json') {
  try {
    const analytics = await getWorkoutAnalytics('1year');
    
    if (format === 'json') {
      const dataStr = JSON.stringify(analytics, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-analytics-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // Create CSV format for exercise data
      const csvData = convertToCSV(analytics);
      const dataBlob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      URL.revokeObjectURL(url);
    }
    
    alert(`Analytics data exported as ${format.toUpperCase()}`);
  } catch (error) {
    alert('Failed to export analytics data');
  }
}

function convertToCSV(analytics) {
  const headers = ['Date', 'Exercise', 'Group', 'Weight', 'Reps', 'Volume'];
  const rows = [headers.join(',')];
  
  analytics.exerciseAnalytics?.forEach((stats, name) => {
    stats.progression?.forEach(point => {
      rows.push([
        point.date,
        name,
        stats.group,
        point.weight || '',
        point.reps || point.time || '',
        point.volume || ''
      ].join(','));
    });
  });
  
  return rows.join('\n');
}
