<script lang="ts">
  import { getPropertyValue } from './basesParser';
  
  export let files: any[] = [];
  export let dateField: string = 'created';  // Field containing date
  export let titleField: string = 'file.name';
  export let descriptionField: string = 'summary';
  
  // Current date values
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  
  // Date navigation
  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }
  
  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }
  
  function resetToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
  }
  
  // Generate the calendar days
  $: calendarDays = generateCalendarDays(currentYear, currentMonth);
  $: monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });
  
  function generateCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const startingDayOfWeek = firstDay.getDay();
    
    // Generate days from previous month to fill the first week
    const prevMonthDays = [];
    if (startingDayOfWeek > 0) {
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = prevMonthLastDay - startingDayOfWeek + 1; i <= prevMonthLastDay; i++) {
        prevMonthDays.push({
          date: new Date(year, month - 1, i),
          day: i,
          isCurrentMonth: false
        });
      }
    }
    
    // Generate days for current month
    const currentMonthDays = [];
    for (let i = 1; i <= daysInMonth; i++) {
      currentMonthDays.push({
        date: new Date(year, month, i),
        day: i,
        isCurrentMonth: true
      });
    }
    
    // Generate days for next month to fill the last week
    const nextMonthDays = [];
    const totalDaysSoFar = prevMonthDays.length + currentMonthDays.length;
    const remainingCells = 42 - totalDaysSoFar; // 6 rows x 7 days
    
    for (let i = 1; i <= remainingCells; i++) {
      nextMonthDays.push({
        date: new Date(year, month + 1, i),
        day: i,
        isCurrentMonth: false
      });
    }
    
    return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
  }
  
  // Filter files for each day
  function getFilesForDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return files.filter(file => {
      const fileDate = new Date(getPropertyValue(file, dateField));
      return fileDate >= startOfDay && fileDate <= endOfDay;
    });
  }
  
  // Determine if a day has files
  function hasFilesForDate(date: Date) {
    return getFilesForDate(date).length > 0;
  }
  
  // Get first 3 files for a date (for display in calendar)
  function getDisplayFilesForDate(date: Date) {
    return getFilesForDate(date).slice(0, 3);
  }
  
  // Day name headers
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<div class="calendar-view">
  <div class="calendar-header">
    <div class="month-nav">
      <button on:click={prevMonth}>←</button>
      <h3>{monthName} {currentYear}</h3>
      <button on:click={nextMonth}>→</button>
    </div>
    <button class="today-button" on:click={resetToToday}>Today</button>
  </div>
  
  <div class="calendar-grid">
    <div class="calendar-days-header">
      {#each dayNames as day}
        <div class="day-name">{day}</div>
      {/each}
    </div>
    
    <div class="calendar-days">
      {#each calendarDays as { date, day, isCurrentMonth }, i}
        <div class="day-cell {isCurrentMonth ? 'current-month' : 'other-month'}">
          <div class="day-number">{day}</div>
          {#if hasFilesForDate(date)}
            <div class="day-events">
              {#each getDisplayFilesForDate(date) as file}
                <div class="event">
                  <span class="event-title">{getPropertyValue(file, titleField)}</span>
                </div>
              {/each}
              
              {#if getFilesForDate(date).length > 3}
                <div class="more-events">+{getFilesForDate(date).length - 3} more</div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .calendar-view {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 6px 6px 0 0;
  }
  
  .month-nav {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .month-nav button {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 30px;
    height: 30px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .month-nav h3 {
    margin: 0;
    font-size: 16px;
    min-width: 150px;
    text-align: center;
  }
  
  .today-button {
    background: #50567a;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .calendar-grid {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid #eee;
    border-radius: 0 0 6px 6px;
  }
  
  .calendar-days-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: #f9f9f9;
    border-bottom: 1px solid #eee;
  }
  
  .day-name {
    padding: 10px;
    text-align: center;
    font-weight: 500;
    font-size: 14px;
    color: #666;
  }
  
  .calendar-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    flex-grow: 1;
  }
  
  .day-cell {
    border-right: 1px solid #eee;
    border-bottom: 1px solid #eee;
    padding: 5px;
    min-height: 80px;
    display: flex;
    flex-direction: column;
  }
  
  .day-cell:nth-child(7n) {
    border-right: none;
  }
  
  .day-cell.other-month {
    background: #f9f9f9;
    color: #aaa;
  }
  
  .day-number {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 5px;
  }
  
  .day-events {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
  }
  
  .event {
    background: #e9efff;
    border-left: 3px solid #50567a;
    padding: 3px 5px;
    border-radius: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .event-title {
    font-size: 11px;
  }
  
  .more-events {
    font-size: 11px;
    color: #666;
    text-align: center;
    margin-top: 2px;
  }
</style> 