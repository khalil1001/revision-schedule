// Supabase configuration
const SUPABASE_URL = 'https://uulyeqatvlxcgictfhna.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1bHllcWF0dmx4Y2dpY3RmaG5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1MzgxNjAsImV4cCI6MjA2MzExNDE2MH0.DHK050xpVo8n27Ylx1C0TQisoR3_EsxHv0fIF8P7CBs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global variables
let calendar;
let currentSchedule = [];
let themes = [];
let lessons = [];
let currentLessonId = null;
let currentUser = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  // Set default dates
  const today = new Date();
  document.getElementById('start-date').valueAsDate = today;
  
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(today.getMonth() + 3);
  document.getElementById('end-date').valueAsDate = threeMonthsLater;
  
  // Initialize calendar
  initializeCalendar();
  
  // Check authentication status
  checkAuthStatus();
  
  // Set up event listeners
  setupEventListeners();
});

// Authentication functions
async function login() {
  const email = document.getElementById('email').value;
  if (!email) {
    alert("Please enter your email");
    return;
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) {
      alert("Login failed: " + error.message);
    } else {
      alert("Check your email for the login link");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("An error occurred during login");
  }
}

async function logout() {
  try {
    await supabase.auth.signOut();
    updateAuthUI(null);
    clearThemeList();
    document.getElementById('scheduleSelector').innerHTML = '<option value="">Select a saved schedule</option>';
    calendar.removeAllEvents();
    currentUser = null;
  } catch (error) {
    console.error("Logout error:", error);
    alert("An error occurred during logout");
  }
}

function checkAuthStatus() {
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAuthUI(session?.user);
    if (session) {
      currentUser = session.user;
      loadThemes();
      loadSavedSchedules();
      createLessonManagementUI();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user);
    if (session) {
      currentUser = session.user;
      loadThemes();
      loadSavedSchedules();
      createLessonManagementUI();
    }
  });
}

function updateAuthUI(user) {
  const loggedOutUI = document.querySelector('.auth-logged-out');
  const loggedInUI = document.querySelector('.auth-logged-in');
  const userEmailElement = document.getElementById('user-email');
  const appContent = document.getElementById('app-content');
  
  if (user) {
    loggedOutUI.style.display = 'none';
    loggedInUI.style.display = 'flex';
    userEmailElement.textContent = user.email;
    appContent.style.display = 'flex';
  } else {
    loggedOutUI.style.display = 'flex';
    loggedInUI.style.display = 'none';
    userEmailElement.textContent = '';
    appContent.style.display = 'none';
  }
}

// Calendar functions
function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');
  
  // Ensure the calendar element exists
  if (!calendarEl) {
    console.error("Calendar element not found");
    return;
  }
  
  // Initialize FullCalendar
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    events: [],
    eventClick: function(info) {
      openLessonEditModal(info.event);
    }
  });
  
  // Render the calendar
  calendar.render();
}

// Theme management functions
async function loadThemes() {
  try {
    if (!currentUser) {
      console.error("No user logged in");
      return;
    }
    
    const { data: userThemes, error } = await supabase
      .from('themes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('order');
      
    if (error) {
      console.error("Error loading themes:", error);
      alert("Failed to load themes: " + error.message);
      return;
    }
    
    // If no themes exist for the user, create default themes
    if (!userThemes || userThemes.length === 0) {
      await createDefaultThemes();
      return;
    }
    
    themes = userThemes;
    renderThemeList();
  } catch (error) {
    console.error("Error in loadThemes:", error);
    alert("An error occurred while loading themes");
  }
}

async function createDefaultThemes() {
  try {
    if (!currentUser) {
      console.error("No user logged in");
      return;
    }
    
    const defaultThemes = [
      "Psychiatrie", "Gynéco", "Orl/ophtalmo", "Chir", "Neuro", 
      "Cardio", "Gastro", "Pneumo", "Endocrino", "Hemato", 
      "Infectieux", "Nephro", "Ortho/rhum", "Pédiatrie", "Rea", "Uro"
    ];
    
    const themesToInsert = defaultThemes.map((name, index) => ({
      name,
      order: index,
      user_id: currentUser.id
    }));
    
    const { data, error } = await supabase
      .from('themes')
      .insert(themesToInsert)
      .select();
      
    if (error) {
      console.error("Error creating default themes:", error);
      alert("Failed to create default themes: " + error.message);
      return;
    }
    
    themes = data;
    renderThemeList();
  } catch (error) {
    console.error("Error in createDefaultThemes:", error);
    alert("An error occurred while creating default themes");
  }
}

function renderThemeList() {
  const themeList = document.getElementById('theme-list');
  if (!themeList) {
    console.error("Theme list element not found");
    return;
  }
  
  themeList.innerHTML = '';
  
  themes.forEach(theme => {
    const li = document.createElement('li');
    li.className = 'theme-item';
    li.setAttribute('draggable', true);
    li.setAttribute('data-id', theme.id);
    
    li.innerHTML = `
      <div class="drag-handle">⋮⋮</div>
      <div class="theme-name">${theme.name}</div>
    `;
    
    // Set up drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);
    
    themeList.appendChild(li);
  });
}

function clearThemeList() {
  const themeList = document.getElementById('theme-list');
  if (themeList) {
    themeList.innerHTML = '';
  }
  themes = [];
}

// Drag and drop functionality
function handleDragStart(e) {
  this.classList.add('dragging');
  e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
  e.preventDefault();
  const draggedItemId = e.dataTransfer.getData('text/plain');
  const draggedItem = document.querySelector(`.theme-item[data-id="${draggedItemId}"]`);
  const dropTarget = this;
  
  if (draggedItem !== dropTarget) {
    const themeList = document.getElementById('theme-list');
    const items = Array.from(themeList.querySelectorAll('.theme-item'));
    const draggedIndex = items.indexOf(draggedItem);
    const targetIndex = items.indexOf(dropTarget);
    
    if (draggedIndex < targetIndex) {
      themeList.insertBefore(draggedItem, dropTarget.nextSibling);
    } else {
      themeList.insertBefore(draggedItem, dropTarget);
    }
    
    // Update the order in the themes array
    updateThemesOrder();
  }
}

function handleDragEnd() {
  this.classList.remove('dragging');
}

function updateThemesOrder() {
  const themeItems = document.querySelectorAll('.theme-item');
  const updatedThemes = [];
  
  Array.from(themeItems).forEach((item, index) => {
    const themeId = item.getAttribute('data-id');
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      updatedThemes.push({
        ...theme,
        order: index
      });
    }
  });
  
  themes = updatedThemes;
}

async function saveThemeOrder() {
  try {
    if (!currentUser) {
      alert("You must be logged in to save theme order");
      return;
    }
    
    // Create an array of objects with only id and order for the upsert
    const updates = themes.map(theme => ({
      id: theme.id,
      order: theme.order,
      user_id: currentUser.id  // Include user_id for RLS policies
    }));
    
    console.log("Saving theme order:", updates);
    
    const { error } = await supabase
      .from('themes')
      .upsert(updates, { onConflict: 'id' });
      
    if (error) {
      console.error("Error saving theme order:", error);
      alert("Failed to save theme order: " + error.message);
    } else {
      alert("Theme order saved successfully");
    }
  } catch (error) {
    console.error("Error in saveThemeOrder:", error);
    alert("An error occurred while saving theme order");
  }
}

// Lesson management functions
async function createLessonManagementUI() {
  try {
    if (!currentUser) {
      console.error("No user logged in");
      return;
    }
    
    // Load lessons from database
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('user_id', currentUser.id);
      
    if (lessonError) {
      console.error("Error loading lessons:", lessonError);
      alert("Failed to load lessons: " + lessonError.message);
      return;
    }
    
    // If no lessons exist, create some default ones
    if (!lessonData || lessonData.length === 0) {
      await createDefaultLessons();
    } else {
      lessons = lessonData;
    }
  } catch (error) {
    console.error("Error in createLessonManagementUI:", error);
    alert("An error occurred while setting up lesson management");
  }
}

async function createDefaultLessons() {
  try {
    if (!currentUser) {
      console.error("No user logged in");
      return;
    }
    
    // Get themes first
    const { data: userThemes, error: themeError } = await supabase
      .from('themes')
      .select('*')
      .eq('user_id', currentUser.id);
      
    if (themeError || !userThemes || userThemes.length === 0) {
      console.error("No themes available for creating lessons:", themeError);
      alert("Failed to load themes for lesson creation");
      return;
    }
    
    // Create some default lessons for each theme
    const defaultLessons = [];
    
    userThemes.forEach(theme => {
      // Create 2 lessons per theme
      defaultLessons.push({
        name: `${theme.name} - Basics`,
        difficulty: 2,
        user_id: currentUser.id,
        theme_id: theme.id
      });
      
      defaultLessons.push({
        name: `${theme.name} - Advanced`,
        difficulty: 4,
        user_id: currentUser.id,
        theme_id: theme.id
      });
    });
    
    const { data, error } = await supabase
      .from('lessons')
      .insert(defaultLessons)
      .select();
      
    if (error) {
      console.error("Error creating default lessons:", error);
      alert("Failed to create default lessons: " + error.message);
      return;
    }
    
    lessons = data;
  } catch (error) {
    console.error("Error in createDefaultLessons:", error);
    alert("An error occurred while creating default lessons");
  }
}

// Lesson editing functions
function openLessonEditModal(event) {
  const lessonId = event.extendedProps.lessonId;
  const lessonName = event.extendedProps.lesson;
  const difficulty = event.extendedProps.difficulty;
  
  document.getElementById('edit-lesson-name').value = lessonName;
  document.getElementById('edit-lesson-difficulty').value = difficulty;
  
  currentLessonId = lessonId;
  
  document.getElementById('lesson-edit-modal').style.display = 'flex';
}

function closeLessonEditModal() {
  document.getElementById('lesson-edit-modal').style.display = 'none';
  currentLessonId = null;
}

async function saveLessonEdit() {
  try {
    if (!currentUser) {
      alert("You must be logged in to edit lessons");
      return;
    }
    
    const newName = document.getElementById('edit-lesson-name').value;
    const newDifficulty = parseInt(document.getElementById('edit-lesson-difficulty').value);
    
    if (!newName || isNaN(newDifficulty)) {
      alert("Please provide valid values for name and difficulty");
      return;
    }
    
    // Find the lesson in our local array
    const lessonIndex = lessons.findIndex(l => l.id === currentLessonId);
    
    // Find a theme to associate with this lesson
    // For simplicity, we'll use the first theme if none is associated
    let themeId = null;
    if (themes && themes.length > 0) {
      themeId = themes[0].id;
    }
    
    if (lessonIndex === -1) {
      // This is a new lesson from a generated schedule, need to create it first
      console.log("Creating new lesson:", newName, newDifficulty, themeId);
      
      const { data, error } = await supabase
        .from('lessons')
        .insert([{
          name: newName,
          difficulty: newDifficulty,
          user_id: currentUser.id,
          theme_id: themeId
        }])
        .select();
        
      if (error) {
        console.error("Error creating new lesson:", error);
        alert("Failed to create new lesson: " + error.message);
        return;
      }
      
      // Update the current lesson ID to the newly created one
      currentLessonId = data[0].id;
      lessons.push(data[0]);
      
      console.log("New lesson created:", data[0]);
    } else {
      // Update existing lesson
      // Preserve the existing theme_id if it exists
      const existingThemeId = lessons[lessonIndex].theme_id;
      
      console.log("Updating lesson:", currentLessonId, newName, newDifficulty, existingThemeId || themeId);
      
      const { error } = await supabase
        .from('lessons')
        .update({
          name: newName,
          difficulty: newDifficulty,
          theme_id: existingThemeId || themeId
        })
        .eq('id', currentLessonId);
        
      if (error) {
        console.error("Error updating lesson:", error);
        alert("Failed to update lesson: " + error.message);
        return;
      }
      
      // Update the lesson in the local array
      lessons[lessonIndex].name = newName;
      lessons[lessonIndex].difficulty = newDifficulty;
      if (!lessons[lessonIndex].theme_id) {
        lessons[lessonIndex].theme_id = themeId;
      }
      
      console.log("Lesson updated:", lessons[lessonIndex]);
    }
    
    // Update the event on the calendar
    const events = calendar.getEvents();
    events.forEach(event => {
      if (event.extendedProps.lessonId === currentLessonId) {
        const eventType = event.extendedProps.type;
        event.setProp('title', `${eventType}: ${newName}`);
        event.setExtendedProp('lesson', newName);
        event.setExtendedProp('difficulty', newDifficulty);
      }
    });
    
    closeLessonEditModal();
    alert("Lesson updated successfully");
  } catch (error) {
    console.error("Error in saveLessonEdit:", error);
    alert("An error occurred while updating the lesson");
  }
}

// Schedule management functions
async function loadSavedSchedules() {
  try {
    if (!currentUser) {
      console.error("No user logged in");
      return;
    }
    
    const { data, error } = await supabase
      .from('schedules')
      .select('id, title')
      .eq('user_id', currentUser.id);
      
    if (error) {
      console.error("Error loading saved schedules:", error);
      alert("Failed to load saved schedules: " + error.message);
      return;
    }
    
    const selector = document.getElementById('scheduleSelector');
    if (!selector) {
      console.error("Schedule selector element not found");
      return;
    }
    
    selector.innerHTML = '<option value="">Select a saved schedule</option>';
    
    data.forEach(schedule => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = schedule.title;
      selector.appendChild(option);
    });
  } catch (error) {
    console.error("Error in loadSavedSchedules:", error);
    alert("An error occurred while loading saved schedules");
  }
}

async function loadSchedule(scheduleId) {
  try {
    if (!currentUser) {
      alert("You must be logged in to load schedules");
      return;
    }
    
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .eq('user_id', currentUser.id)
      .single();
      
    if (error) {
      console.error("Error loading schedule:", error);
      alert("Failed to load schedule: " + error.message);
      return;
    }
    
    currentSchedule = data.data;
    
    // Display on calendar
    displayScheduleOnCalendar(currentSchedule);
  } catch (error) {
    console.error("Error in loadSchedule:", error);
    alert("An error occurred while loading the schedule");
  }
}

function displayScheduleOnCalendar(scheduleData) {
  if (!calendar) {
    console.error("Calendar not initialized");
    return;
  }
  
  calendar.removeAllEvents();
  
  if (!scheduleData || scheduleData.length === 0) {
    console.warn("No schedule data to display");
    return;
  }
  
  const events = scheduleData.map(entry => {
    return {
      title: `${entry.type}: ${entry.lesson}`,
      start: entry.date,
      allDay: true,
      backgroundColor: entry.type === 'NEW' ? '#81d4fa' : '#aed581',
      borderColor: entry.type === 'NEW' ? '#0288d1' : '#689f38',
      textColor: 'black',
      extendedProps: {
        type: entry.type,
        lesson: entry.lesson,
        difficulty: entry.difficulty,
        reviewLabel: entry.reviewLabel,
        lessonId: entry.lessonId
      }
    };
  });
  
  calendar.addEventSource(events);
}

// Scheduling logic
class SchedulingConstants {
  constructor(config = {}) {
    this.REVIEW_OFFSETS = config.REVIEW_OFFSETS || [2, 7, 21, 42];
    this.SECOND_REVIEW_DIFFICULTY = config.SECOND_REVIEW_DIFFICULTY || 0.5;
    this.MAX_DAILY_DIFFICULTY = config.MAX_DAILY_DIFFICULTY || 5;
    this.START_DATE = config.START_DATE ? new Date(config.START_DATE) : new Date();
    this.END_DATE = config.END_DATE ? new Date(config.END_DATE) : new Date(this.START_DATE.getTime() + (180 * 24 * 60 * 60 * 1000));
    this.TOTAL_DAYS = config.TOTAL_DAYS || 180;
  }
  
  toJSON() {
    return {
      REVIEW_OFFSETS: this.REVIEW_OFFSETS,
      SECOND_REVIEW_DIFFICULTY: this.SECOND_REVIEW_DIFFICULTY,
      MAX_DAILY_DIFFICULTY: this.MAX_DAILY_DIFFICULTY,
      START_DATE: this.START_DATE.toISOString(),
      END_DATE: this.END_DATE.toISOString(),
      TOTAL_DAYS: this.TOTAL_DAYS
    };
  }
  
  static fromJSON(json) {
    return new SchedulingConstants(json);
  }
}

class ScheduleGenerator {
  constructor(constants, lessons = []) {
    this.constants = constants;
    this.lessons = lessons;
    this.calendar = new Map();
    this.dailyDifficulty = new Map();
    this.lessonDates = new Map();
    this.pendingReviews = [];
  }
  
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }
  
  getDailyDifficulty(date) {
    const dateStr = this.formatDate(date);
    return this.dailyDifficulty.get(dateStr) || 0;
  }
  
  setDailyDifficulty(date, difficulty) {
    const dateStr = this.formatDate(date);
    this.dailyDifficulty.set(dateStr, difficulty);
  }
  
  addToDailyDifficulty(date, difficulty) {
    const dateStr = this.formatDate(date);
    const current = this.dailyDifficulty.get(dateStr) || 0;
    this.dailyDifficulty.set(dateStr, current + difficulty);
  }
  
  addToCalendar(date, event) {
    const dateStr = this.formatDate(date);
    if (!this.calendar.has(dateStr)) {
      this.calendar.set(dateStr, []);
    }
    this.calendar.get(dateStr).push(event);
  }
  
  generateSchedule() {
    let currentLessonIndex = 0;
    let day = new Date(this.constants.START_DATE);
    
    // Sort lessons by theme order if available
    this.lessons.sort((a, b) => {
      const themeA = themes.find(t => t.id === a.theme_id);
      const themeB = themes.find(t => t.id === b.theme_id);
      
      if (themeA && themeB) {
        return themeA.order - themeB.order;
      }
      return 0;
    });
    
    while (currentLessonIndex < this.lessons.length || this.pendingReviews.length > 0) {
      // Step 1: Schedule NEW lessons only if not Sunday
      if (currentLessonIndex < this.lessons.length && day.getDay() !== 0) {
        const lesson = this.lessons[currentLessonIndex];
        if (this.getDailyDifficulty(day) + lesson.difficulty <= this.constants.MAX_DAILY_DIFFICULTY) {
          this.addToCalendar(day, {
            type: 'NEW',
            lesson: lesson.name,
            difficulty: lesson.difficulty,
            lessonId: lesson.id
          });
          
          this.addToDailyDifficulty(day, lesson.difficulty);
          this.lessonDates.set(lesson.name, this.formatDate(day));
          
          // Queue reviews
          for (const offset of this.constants.REVIEW_OFFSETS) {
            const reviewDay = this.addDays(day, offset);
            this.pendingReviews.push({
              lesson: lesson,
              targetDate: reviewDay,
              offset: offset
            });
          }
          
          currentLessonIndex++;
        }
      }
      
      // Step 2: Schedule reviews (even on Sundays)
      this.pendingReviews.sort((a, b) => b.lesson.difficulty - a.lesson.difficulty);
      const remainingReviews = [];
      
      for (const review of this.pendingReviews) {
        if (review.targetDate <= day) {
          const reviewDifficulty = this.constants.SECOND_REVIEW_DIFFICULTY * review.lesson.difficulty;
          
          if (this.getDailyDifficulty(day) + reviewDifficulty <= this.constants.MAX_DAILY_DIFFICULTY) {
            this.addToCalendar(day, {
              type: 'REVIEW',
              lesson: review.lesson.name,
              difficulty: reviewDifficulty,
              reviewLabel: `${review.offset}-day`,
              lessonId: review.lesson.id
            });
            
            this.addToDailyDifficulty(day, reviewDifficulty);
          } else {
            remainingReviews.push(review);
          }
        } else {
          remainingReviews.push(review);
        }
      }
      
      this.pendingReviews = remainingReviews;
      day = this.addDays(day, 1);
      
      // Safety check to prevent infinite loops
      if (day > this.constants.END_DATE) {
        console.warn("Reached end date with unscheduled items");
        break;
      }
    }
    
    return {
      calendar: this.formatCalendarOutput(),
      dailyDifficulty: Object.fromEntries(this.dailyDifficulty),
      lessonDates: Object.fromEntries(this.lessonDates),
      pendingReviews: this.pendingReviews.length
    };
  }
  
  formatCalendarOutput() {
    const result = [];
    
    for (const [dateStr, events] of this.calendar.entries()) {
      for (const event of events) {
        result.push({
          date: dateStr,
          type: event.type,
          lesson: event.lesson,
          difficulty: event.difficulty,
          reviewLabel: event.reviewLabel || null,
          lessonId: event.lessonId
        });
      }
    }
    
    return result;
  }
}

async function generateSchedule() {
  try {
    if (!currentUser) {
      alert("You must be logged in to generate a schedule");
      return;
    }
    
    // Get user-configured constants
    const reviewOffsets = document.getElementById('review-offsets').value
      .split(',')
      .map(x => parseInt(x.trim()))
      .filter(x => !isNaN(x));
      
    const secondReviewDifficulty = parseFloat(document.getElementById('second-review-difficulty').value);
    const maxDailyDifficulty = parseInt(document.getElementById('max-daily-difficulty').value);
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    // Create constants object
    const constants = new SchedulingConstants({
      REVIEW_OFFSETS: reviewOffsets,
      SECOND_REVIEW_DIFFICULTY: secondReviewDifficulty,
      MAX_DAILY_DIFFICULTY: maxDailyDifficulty,
      START_DATE: startDate,
      END_DATE: endDate
    });
    
    // Make sure we have themes loaded
    if (themes.length === 0) {
      await loadThemes();
    }
    
    // Get lessons from database with their themes
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('user_id', currentUser.id);
      
    if (lessonError) {
      console.error("Error loading lessons:", lessonError);
      alert("Failed to load lessons: " + lessonError.message);
      return;
    }
    
    if (!lessonData || lessonData.length === 0) {
      alert("No lessons found. Creating default lessons...");
      await createDefaultLessons();
      
      // Try again with the newly created lessons
      const { data: newLessonData, error: newLessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('user_id', currentUser.id);
        
      if (newLessonError || !newLessonData || newLessonData.length === 0) {
        alert("Failed to create lessons. Please try again later.");
        return;
      }
      
      lessons = newLessonData;
    } else {
      lessons = lessonData;
    }
    
    // Generate schedule
    const generator = new ScheduleGenerator(constants, lessons);
    const result = generator.generateSchedule();
    
    // Display on calendar
    currentSchedule = result.calendar;
    displayScheduleOnCalendar(result.calendar);
    
    // Ask user if they want to save this schedule
    const saveSchedule = confirm('Schedule generated successfully! Would you like to save it?');
    if (saveSchedule) {
      const title = prompt('Enter a title for this schedule:');
      if (title) {
        console.log("Saving schedule:", {
          title,
          user_id: currentUser.id,
          data: result.calendar,
          config: constants.toJSON()
        });
        
        const { data, error } = await supabase
          .from('schedules')
          .insert([{
            title,
            user_id: currentUser.id,
            data: result.calendar,
            config: constants.toJSON()
          }])
          .select();
          
        if (error) {
          console.error("Error saving schedule:", error);
          alert("Failed to save schedule: " + error.message);
        } else {
          alert("Schedule saved successfully");
          loadSavedSchedules();
        }
      }
    }
  } catch (error) {
    console.error("Error in generateSchedule:", error);
    alert("An error occurred while generating the schedule");
  }
}

// Set up event listeners
function setupEventListeners() {
  // Schedule selector
  const scheduleSelector = document.getElementById('scheduleSelector');
  if (scheduleSelector) {
    scheduleSelector.addEventListener('change', function() {
      const scheduleId = this.value;
      if (scheduleId) {
        loadSchedule(scheduleId);
      }
    });
  }
  
  // Save theme order button
  const saveThemeOrderBtn = document.getElementById('save-theme-order');
  if (saveThemeOrderBtn) {
    saveThemeOrderBtn.addEventListener('click', saveThemeOrder);
  }
  
  // Lesson edit modal
  const saveLessonEditBtn = document.getElementById('save-lesson-edit');
  if (saveLessonEditBtn) {
    saveLessonEditBtn.addEventListener('click', saveLessonEdit);
  }
  
  const cancelLessonEditBtn = document.getElementById('cancel-lesson-edit');
  if (cancelLessonEditBtn) {
    cancelLessonEditBtn.addEventListener('click', closeLessonEditModal);
  }
  
  // Generate schedule button
  const generateScheduleBtn = document.getElementById('generate-schedule');
  if (generateScheduleBtn) {
    generateScheduleBtn.addEventListener('click', generateSchedule);
  }
}
