// =========================
// WORKOUT EXPORT/IMPORT FUNCTIONALITY
// =========================

import { state } from './state.js';
import { apiGet, apiPost } from './api.js';

/**
 * Export workout data in various formats
 */
export class WorkoutExporter {
  /**
   * Export all workout data as JSON
   */
  static async exportWorkoutsAsJSON() {
    try {
      const workouts = state.workouts || [];
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        data: {
          workouts: workouts,
          settings: {
            soreness: state.soreness,
            fatigue: state.fatigue,
            weeklyLoad: state.weeklyLoad
          },
          statistics: {
            totalWorkouts: workouts.length,
            dateRange: workouts.length > 0 ? {
              first: workouts[workouts.length - 1]?.date,
              last: workouts[0]?.date
            } : null
          }
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        message: `Exported ${workouts.length} workouts to JSON`
      };
    } catch (error) {
      throw new Error(`Failed to export workouts: ${error.message}`);
    }
  }

  /**
   * Export workouts as CSV
   */
  static async exportWorkoutsAsCSV() {
    try {
      const workouts = state.workouts || [];
      
      if (workouts.length === 0) {
        throw new Error('No workouts to export');
      }

      // Create CSV headers
      const headers = [
        'Date', 'Group', 'Exercise', 'Set', 'Weight (kg)', 'Reps', 
        'Time (sec)', 'Rest (sec)', 'Notes'
      ];
      
      // Convert workout data to CSV rows
      const rows = [headers.join(',')];
      
      workouts.forEach(workout => {
        workout.exercises?.forEach(exercise => {
          exercise.sets?.forEach((set, setIndex) => {
            const row = [
              workout.date || '',
              exercise.group || '',
              exercise.name || '',
              setIndex + 1,
              set.weight || '',
              set.reps || '',
              set.duration_sec || '',
              set.rest_sec || '',
              set.notes || ''
            ];
            rows.push(row.map(cell => `"${cell}"`).join(','));
          });
        });
      });

      const csvData = rows.join('\n');
      const dataBlob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-export-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        message: `Exported ${workouts.length} workouts to CSV`
      };
    } catch (error) {
      throw new Error(`Failed to export CSV: ${error.message}`);
    }
  }

  /**
   * Export workout summary as PDF (text-based)
   */
  static async exportWorkoutSummary() {
    try {
      const workouts = state.workouts || [];
      
      if (workouts.length === 0) {
        throw new Error('No workouts to export');
      }

      // Create summary content
      let summary = `WORKOUT SUMMARY\n`;
      summary += `Generated: ${new Date().toLocaleDateString()}\n`;
      summary += `Total Workouts: ${workouts.length}\n\n`;
      
      // Group workouts by month
      const workoutsByMonth = {};
      workouts.forEach(workout => {
        const date = new Date(workout.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!workoutsByMonth[monthKey]) {
          workoutsByMonth[monthKey] = [];
        }
        workoutsByMonth[monthKey].push(workout);
      });

      Object.keys(workoutsByMonth).sort().reverse().forEach(month => {
        summary += `\n${month} (${workoutsByMonth[month].length} workouts)\n`;
        summary += `${'='.repeat(50)}\n`;
        
        workoutsByMonth[month].forEach(workout => {
          summary += `\n${workout.date} - ${workout.groups?.join(', ') || 'No groups'}\n`;
          
          workout.exercises?.forEach(exercise => {
            summary += `  • ${exercise.name}\n`;
            exercise.sets?.forEach((set, index) => {
              const details = [];
              if (set.weight) details.push(`${set.weight}kg`);
              if (set.reps) details.push(`${set.reps} reps`);
              if (set.duration_sec) details.push(`${set.duration_sec}s`);
              summary += `    Set ${index + 1}: ${details.join(', ')}\n`;
            });
          });
        });
      });

      // Create and download text file
      const dataBlob = new Blob([summary], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `workout-summary-${new Date().toISOString().split('T')[0]}.txt`;
      link.click();
      
      URL.revokeObjectURL(url);
      
      return {
        success: true,
        message: `Exported workout summary to text file`
      };
    } catch (error) {
      throw new Error(`Failed to export summary: ${error.message}`);
    }
  }
}

/**
 * Import workout data from various sources
 */
export class WorkoutImporter {
  /**
   * Import workouts from JSON file
   */
  static async importWorkoutsFromJSON(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the import data
      if (!data.data || !data.data.workouts) {
        throw new Error('Invalid workout export file format');
      }

      const importedWorkouts = data.data.workouts;
      const existingDates = new Set(state.workouts?.map(w => w.date) || []);
      
      // Check for duplicates
      const duplicates = importedWorkouts.filter(w => existingDates.has(w.date));
      const newWorkouts = importedWorkouts.filter(w => !existingDates.has(w.date));
      
      if (duplicates.length > 0) {
        const proceed = confirm(
          `Found ${duplicates.length} workouts that already exist. ` +
          `Import only ${newWorkouts.length} new workouts?`
        );
        if (!proceed) return { cancelled: true };
      }

      // Import new workouts
      let importedCount = 0;
      for (const workout of newWorkouts) {
        try {
          await apiPost('/api/workouts', workout);
          importedCount++;
        } catch (error) {
                  }
      }

      // Refresh workout data
      await this.refreshWorkoutData();

      return {
        success: true,
        imported: importedCount,
        duplicates: duplicates.length,
        message: `Successfully imported ${importedCount} workouts`
      };
    } catch (error) {
      throw new Error(`Failed to import workouts: ${error.message}`);
    }
  }

  /**
   * Parse CSV workout data
   */
  static parseWorkoutCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const workouts = {};

    lines.slice(1).forEach(line => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      if (values.length < headers.length) return;

      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      if (!row.Date) return;

      if (!workouts[row.Date]) {
        workouts[row.Date] = {
          date: row.Date,
          groups: new Set(),
          exercises: {}
        };
      }

      const workout = workouts[row.Date];
      if (row.Group) workout.groups.add(row.Group);

      if (!workout.exercises[row.Exercise]) {
        workout.exercises[row.Exercise] = {
          name: row.Exercise,
          group: row.Group,
          sets: []
        };
      }

      const set = {
        weight: parseFloat(row['Weight (kg)']) || null,
        reps: parseInt(row.Reps) || null,
        duration_sec: parseInt(row['Time (sec)']) || null,
        rest_sec: parseInt(row['Rest (sec)']) || null,
        notes: row.Notes || null
      };

      workout.exercises[row.Exercise].sets.push(set);
    });

    // Convert to final format
    return Object.values(workouts).map(workout => ({
      ...workout,
      groups: Array.from(workout.groups),
      exercises: Object.values(workout.exercises)
    }));
  }

  /**
   * Import workouts from CSV file
   */
  static async importWorkoutsFromCSV(file) {
    try {
      const text = await file.text();
      const workouts = this.parseWorkoutCSV(text);
      
      if (workouts.length === 0) {
        throw new Error('No valid workouts found in CSV file');
      }

      const existingDates = new Set(state.workouts?.map(w => w.date) || []);
      const newWorkouts = workouts.filter(w => !existingDates.has(w.date));
      
      if (newWorkouts.length === 0) {
        throw new Error('All workouts in CSV already exist');
      }

      // Import workouts
      let importedCount = 0;
      for (const workout of newWorkouts) {
        try {
          await apiPost('/api/workouts', workout);
          importedCount++;
        } catch (error) {
                  }
      }

      // Refresh workout data
      await this.refreshWorkoutData();

      return {
        success: true,
        imported: importedCount,
        message: `Successfully imported ${importedCount} workouts from CSV`
      };
    } catch (error) {
      throw new Error(`Failed to import CSV: ${error.message}`);
    }
  }

  /**
   * Refresh workout data from server
   */
  static async refreshWorkoutData() {
    try {
      state.workouts = await apiGet('/api/workouts');
    } catch (error) {
    }
  }
}

/**
 * Create file input and handle file selection
 */
export function createFileInput(accept, multiple = false) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    
    input.onchange = (event) => {
      const files = Array.from(event.target.files);
      if (files.length === 0) {
        reject(new Error('No file selected'));
      } else {
        resolve(multiple ? files : files[0]);
      }
    };
    
    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };
    
    input.click();
  });
}

/**
 * Show import/export modal
 */
export function showExportImportModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Export & Import Workouts</h3>
        <button class="modal-close" onclick="closeExportImportModal()">×</button>
      </div>
      
      <div class="modal-body">
        <div class="export-section">
          <h4>Export Workouts</h4>
          <div class="button-group">
            <button class="export-btn" onclick="exportWorkoutsJSON()">
              📄 Export as JSON
            </button>
            <button class="export-btn" onclick="exportWorkoutsCSV()">
              📊 Export as CSV
            </button>
            <button class="export-btn" onclick="exportWorkoutSummary()">
              📋 Export Summary
            </button>
          </div>
        </div>
        
        <div class="import-section">
          <h4>Import Workouts</h4>
          <div class="button-group">
            <button class="import-btn" onclick="importWorkoutsJSON()">
              📄 Import from JSON
            </button>
            <button class="import-btn" onclick="importWorkoutsCSV()">
              📊 Import from CSV
            </button>
          </div>
        </div>
        
        <div class="info-section">
          <h4>Information</h4>
          <ul>
            <li><strong>JSON Export:</strong> Complete workout data with all details</li>
            <li><strong>CSV Export:</strong> Tabular format for spreadsheet analysis</li>
            <li><strong>Summary Export:</strong> Human-readable workout history</li>
            <li><strong>Import:</strong> Automatically skips duplicate workouts</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

/**
 * Close export/import modal
 */
export function closeExportImportModal() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Global functions for HTML onclick handlers
window.exportWorkoutsJSON = async function() {
  try {
    const result = await WorkoutExporter.exportWorkoutsAsJSON();
    alert(result.message);
    closeExportImportModal();
  } catch (error) {
    alert(error.message);
  }
};

window.exportWorkoutsCSV = async function() {
  try {
    const result = await WorkoutExporter.exportWorkoutsAsCSV();
    alert(result.message);
    closeExportImportModal();
  } catch (error) {
    alert(error.message);
  }
};

window.exportWorkoutSummary = async function() {
  try {
    const result = await WorkoutExporter.exportWorkoutSummary();
    alert(result.message);
    closeExportImportModal();
  } catch (error) {
    alert(error.message);
  }
};

window.importWorkoutsJSON = async function() {
  try {
    const file = await createFileInput('.json');
    const result = await WorkoutImporter.importWorkoutsFromJSON(file);
    if (!result.cancelled) {
      alert(result.message);
      closeExportImportModal();
      // Refresh the history view
      if (window.loadHistory) {
        await window.loadHistory();
      }
    }
  } catch (error) {
    alert(error.message);
  }
};

window.importWorkoutsCSV = async function() {
  try {
    const file = await createFileInput('.csv');
    const result = await WorkoutImporter.importWorkoutsFromCSV(file);
    alert(result.message);
    closeExportImportModal();
    // Refresh the history view
    if (window.loadHistory) {
      await window.loadHistory();
    }
  } catch (error) {
    alert(error.message);
  }
};

window.closeExportImportModal = closeExportImportModal;
