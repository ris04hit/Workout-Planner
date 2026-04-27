// =========================
// ANALYTICS AND PROGRESS CHARTS
// =========================

import { state } from './state.js';
import { apiGet } from './api.js';

/**
 * Get comprehensive workout analytics
 */
export async function getWorkoutAnalytics(timeframe = '30days') {
  const workouts = state.workouts || [];
  const today = new Date();
  const cutoffDate = getCutoffDate(today, timeframe);
  
  const filteredWorkouts = workouts.filter(w => {
    const workoutDate = new Date(w.date);
    return workoutDate >= cutoffDate;
  });

  return {
    timeframe,
    totalWorkouts: filteredWorkouts.length,
    dateRange: {
      start: cutoffDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    },
    groupAnalytics: getGroupAnalytics(filteredWorkouts),
    exerciseAnalytics: getExerciseAnalytics(filteredWorkouts),
    volumeProgression: getVolumeProgression(filteredWorkouts),
    frequencyAnalysis: getFrequencyAnalysis(filteredWorkouts),
    strengthProgress: getStrengthProgress(filteredWorkouts)
  };
}

/**
 * Get cutoff date based on timeframe
 */
function getCutoffDate(today, timeframe) {
  const cutoff = new Date(today);
  
  switch (timeframe) {
    case '7days':
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case '30days':
      cutoff.setDate(cutoff.getDate() - 30);
      break;
    case '90days':
      cutoff.setDate(cutoff.getDate() - 90);
      break;
    case '1year':
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    default:
      cutoff.setDate(cutoff.getDate() - 30);
  }
  
  return cutoff;
}

/**
 * Analyze training frequency by movement pattern
 */
function getGroupAnalytics(workouts) {
  const groupStats = {};

  workouts.forEach(workout => {
    // Derive patterns from exercises (workouts store ex.pattern, not workout.groups)
    const patterns = [...new Set((workout.exercises || []).map(ex => ex.pattern).filter(Boolean))];

    patterns.forEach(group => {
      if (!groupStats[group]) {
        groupStats[group] = {
          count: 0,
          dates: [],
          volume: 0,
          totalSets: 0,
          avgIntensity: 0
        };
      }

      groupStats[group].count++;
      groupStats[group].dates.push(workout.date);

      workout.exercises?.forEach(ex => {
        if (ex.pattern === group) {
          ex.sets?.forEach(set => {
            const weight = set.weight || 0;
            const reps = set.reps || 0;
            const time = set.duration_sec || 0;

            groupStats[group].totalSets++;

            if (reps > 0) {
              groupStats[group].volume += weight * reps;
            } else if (time > 0) {
              groupStats[group].volume += weight * (time / 60);
            }
          });
        }
      });
    });
  });
  
  // Calculate averages and trends
  Object.keys(groupStats).forEach(group => {
    const stats = groupStats[group];
    stats.avgVolumePerWorkout = stats.count > 0 ? stats.volume / stats.count : 0;
    stats.avgSetsPerWorkout = stats.count > 0 ? stats.totalSets / stats.count : 0;
    
    // Calculate trend (last 3 workouts vs previous)
    if (stats.dates.length >= 6) {
      const recentDates = stats.dates.slice(-3);
      const previousDates = stats.dates.slice(-6, -3);
      stats.trend = calculateTrend(recentDates, previousDates);
    } else {
      stats.trend = 'insufficient_data';
    }
  });
  
  return groupStats;
}

/**
 * Analyze individual exercise performance
 */
function getExerciseAnalytics(workouts) {
  const exerciseStats = {};
  
  workouts.forEach(workout => {
    workout.exercises?.forEach(exercise => {
      const name = exercise.name;
      if (!exerciseStats[name]) {
        exerciseStats[name] = {
          pattern: exercise.pattern,
          count: 0,
          bestWeight: 0,
          bestReps: 0,
          bestVolume: 0,
          bestTime: 0,
          totalVolume: 0,
          sessions: [],
          progression: []
        };
      }
      
      exerciseStats[name].count++;
      exerciseStats[name].sessions.push(workout.date);
      
      exercise.sets?.forEach(set => {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        const time = set.duration_sec || 0;
        
        // Track best performances
        if (weight > exerciseStats[name].bestWeight) {
          exerciseStats[name].bestWeight = weight;
        }
        
        if (reps > 0) {
          exerciseStats[name].bestReps = Math.max(exerciseStats[name].bestReps, reps);
          const volume = weight * reps;
          exerciseStats[name].bestVolume = Math.max(exerciseStats[name].bestVolume, volume);
          exerciseStats[name].totalVolume += volume;
          
          // Track progression
          exerciseStats[name].progression.push({
            date: workout.date,
            weight,
            reps,
            volume
          });
        } else if (time > 0) {
          exerciseStats[name].bestTime = Math.max(exerciseStats[name].bestTime, time);
          const volume = weight * (time / 60);
          exerciseStats[name].totalVolume += volume;
          
          // Track progression for time-based exercises
          exerciseStats[name].progression.push({
            date: workout.date,
            weight,
            time,
            volume
          });
        }
      });
    });
  });
  
  // Calculate averages and trends
  Object.keys(exerciseStats).forEach(name => {
    const stats = exerciseStats[name];
    stats.avgVolumePerSession = stats.count > 0 ? stats.totalVolume / stats.count : 0;
    
    // Sort progression by date
    stats.progression.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate progression trend
    if (stats.progression.length >= 3) {
      stats.progressionTrend = calculateProgressionTrend(stats.progression);
    } else {
      stats.progressionTrend = 'insufficient_data';
    }
  });
  
  return exerciseStats;
}

/**
 * Get volume progression over time
 */
function getVolumeProgression(workouts) {
  const volumeData = [];
  
  workouts.forEach(workout => {
    let totalVolume = 0;
    
    workout.exercises?.forEach(exercise => {
      exercise.sets?.forEach(set => {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        const time = set.duration_sec || 0;
        
        if (reps > 0) {
          totalVolume += weight * reps;
        } else if (time > 0) {
          totalVolume += weight * (time / 60);
        }
      });
    });
    
    volumeData.push({
      date: workout.date,
      volume: totalVolume,
      patternCount: new Set((workout.exercises || []).map(ex => ex.pattern).filter(Boolean)).size
    });
  });
  
  // Sort by date
  volumeData.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return volumeData;
}

/**
 * Analyze training frequency patterns
 */
function getFrequencyAnalysis(workouts) {
  const frequencyData = {};
  const dayOfWeekData = {};
  
  workouts.forEach(workout => {
    const date = new Date(workout.date);
    const weekKey = getWeekKey(date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Weekly frequency
    if (!frequencyData[weekKey]) {
      frequencyData[weekKey] = {
        week: weekKey,
        workouts: 0,
        groups: new Set(),
        volume: 0
      };
    }
    
    frequencyData[weekKey].workouts++;
    workout.groups?.forEach(group => frequencyData[weekKey].groups.add(group));
    
    // Day of week patterns
    if (!dayOfWeekData[dayOfWeek]) {
      dayOfWeekData[dayOfWeek] = {
        dayName: getDayName(dayOfWeek),
        count: 0
      };
    }
    dayOfWeekData[dayOfWeek].count++;
  });
  
  // Convert Sets to arrays and calculate averages
  const weeklyData = Object.values(frequencyData).map(week => ({
    ...week,
    groups: Array.from(week.groups),
    avgGroupsPerWorkout: week.workouts > 0 ? week.groups.length / week.workouts : 0
  }));
  
  return {
    weeklyFrequency: weeklyData,
    dayOfWeekPattern: Object.values(dayOfWeekData),
    avgWorkoutsPerWeek: weeklyData.length > 0 ? 
      weeklyData.reduce((sum, week) => sum + week.workouts, 0) / weeklyData.length : 0
  };
}

/**
 * Get strength progress metrics
 */
function getStrengthProgress(workouts) {
  const strengthData = {};
  
  workouts.forEach(workout => {
    workout.exercises?.forEach(exercise => {
      const name = exercise.name;
      
      exercise.sets?.forEach(set => {
        const weight = set.weight || 0;
        const reps = set.reps || 0;
        
        if (weight > 0 && reps > 0) {
          if (!strengthData[name]) {
            strengthData[name] = {
              group: exercise.group,
              dataPoints: []
            };
          }
          
          strengthData[name].dataPoints.push({
            date: workout.date,
            weight,
            reps,
            estimated1RM: estimateOneRepMax(weight, reps)
          });
        }
      });
    });
  });
  
  // Calculate progress for each exercise
  Object.keys(strengthData).forEach(name => {
    const data = strengthData[name];
    data.dataPoints.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (data.dataPoints.length >= 2) {
      const first = data.dataPoints[0];
      const last = data.dataPoints[data.dataPoints.length - 1];
      
      data.weightProgress = ((last.weight - first.weight) / first.weight) * 100;
      data.strengthProgress = ((last.estimated1RM - first.estimated1RM) / first.estimated1RM) * 100;
      data.timeSpan = Math.floor((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24));
    } else {
      data.weightProgress = 0;
      data.strengthProgress = 0;
      data.timeSpan = 0;
    }
  });
  
  return strengthData;
}

/**
 * Helper functions
 */
function getWeekKey(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const weekStart = new Date(date);
  weekStart.setDate(day - date.getDay());
  
  return `${year}-W${Math.ceil((weekStart.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
}

function getDayName(dayIndex) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex];
}

function calculateTrend(recentDates, previousDates) {
  const recentCount = recentDates.length;
  const previousCount = previousDates.length;
  
  if (recentCount > previousCount) return 'increasing';
  if (recentCount < previousCount) return 'decreasing';
  return 'stable';
}

function calculateProgressionTrend(progressionData) {
  if (progressionData.length < 3) return 'insufficient_data';
  
  const recent = progressionData.slice(-3);
  const previous = progressionData.slice(-6, -3);
  
  const recentAvg = recent.reduce((sum, p) => sum + p.volume, 0) / recent.length;
  const previousAvg = previous.reduce((sum, p) => sum + p.volume, 0) / previous.length;
  
  const change = ((recentAvg - previousAvg) / previousAvg) * 100;
  
  if (change > 5) return 'improving';
  if (change < -5) return 'declining';
  return 'stable';
}

function estimateOneRepMax(weight, reps) {
  // Using the Epley formula: 1RM = weight × (1 + reps/30)
  return weight * (1 + reps / 30);
}

/**
 * Get analytics summary for dashboard
 */
export function getAnalyticsSummary(analytics) {
  const { groupAnalytics, exerciseAnalytics, volumeProgression, frequencyAnalysis, strengthProgress } = analytics;
  
  return {
    totalWorkouts: analytics.totalWorkouts,
    avgWorkoutsPerWeek: frequencyAnalysis.avgWorkoutsPerWeek,
    mostTrainedGroup: getMostTrainedGroup(groupAnalytics),
    totalVolume: volumeProgression.reduce((sum, v) => sum + v.volume, 0),
    avgVolumePerWorkout: analytics.totalWorkouts > 0 ? 
      volumeProgression.reduce((sum, v) => sum + v.volume, 0) / analytics.totalWorkouts : 0,
    topExercises: getTopExercises(exerciseAnalytics, 5),
    strengthGains: getTopStrengthGains(strengthProgress, 3),
    volumeTrend: getVolumeTrend(volumeProgression)
  };
}

function getMostTrainedGroup(groupAnalytics) {
  return Object.entries(groupAnalytics)
    .sort((a, b) => b[1].count - a[1].count)[0]?.[0] || 'None';
}

function getTopExercises(exerciseAnalytics, limit) {
  return Object.entries(exerciseAnalytics)
    .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
    .slice(0, limit)
    .map(([name, stats]) => ({ name, ...stats }));
}

function getTopStrengthGains(strengthProgress, limit) {
  return Object.entries(strengthProgress)
    .filter(([name, stats]) => stats.strengthProgress > 0)
    .sort((a, b) => b[1].strengthProgress - a[1].strengthProgress)
    .slice(0, limit)
    .map(([name, stats]) => ({ name, ...stats }));
}

function getVolumeTrend(volumeProgression) {
  if (volumeProgression.length < 4) return 'insufficient_data';
  
  const recent = volumeProgression.slice(-4);
  const volumes = recent.map(v => v.volume);
  
  let increasing = 0;
  let decreasing = 0;
  
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] > volumes[i-1]) increasing++;
    else if (volumes[i] < volumes[i-1]) decreasing++;
  }
  
  if (increasing > decreasing) return 'increasing';
  if (decreasing > increasing) return 'decreasing';
  return 'stable';
}
