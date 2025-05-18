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
  
  // Load themes if user is authenticated
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      loadThemes();
      loadSavedSchedules();
    }
  });
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
  } catch (error) {
    console.error("Logout error:", error);
    alert("An error occurred during logout");
  }
}

function checkAuthStatus() {
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAuthUI(session?.user);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session?.user);
    if (session) {
      loadThemes();
      loadSavedSchedules();
    }
  });
}

function updateAuthUI(user) {
  const loggedOutUI = document.querySelector('.auth-logged-out');
  const loggedInUI = document.querySelector('.auth-logged-in');
  const userEmailElement = document.getElementById('user-email');
  
  if (user) {
    loggedOutUI.style.display = 'none';
    loggedInUI.style.display = 'flex';
    userEmailElement.textContent = user.email;
  } else {
    loggedOutUI.style.display = 'flex';
    loggedInUI.style.display = 'none';
    userEmailElement.textContent = '';
  }
}

// Calendar functions
function initializeCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [],
    eventClick: function(info) {
      openLessonEditModal(info.event);
    }
  });
  calendar.render();
}

// Theme management functions
async function loadThemes() {
  try {
    const { data: userThemes, error } = await supabase
      .from('themes')
      .select('*')
      .order('order');
      
    if (error) {
      console.error("Error loading themes:", error);
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
  }
}

async function createDefaultThemes() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const defaultThemes = [
      "Psychiatrie", "Gynéco", "Orl/ophtalmo", "Chir", "Neuro", 
      "Cardio", "Gastro", "Pneumo", "Endocrino", "Hemato", 
      "Infectieux", "Nephro", "Ortho/rhum", "Pédiatrie", "Rea", "Uro"
    ];
    
    const themesToInsert = defaultThemes.map((name, index) => ({
      name,
      order: index,
      user_id: user.id
    }));
    
    const { data, error } = await supabase
      .from('themes')
      .insert(themesToInsert)
      .select();
      
    if (error) {
      console.error("Error creating default themes:", error);
      return;
    }
    
    themes = data;
    renderThemeList();
  } catch (error) {
    console.error("Error in createDefaultThemes:", error);
  }
}

function renderThemeList() {
  const themeList = document.getElementById('theme-list');
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
  document.getElementById('theme-list').innerHTML = '';
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
  themes = Array.from(themeItems).map((item, index) => {
    const themeId = item.getAttribute('data-id');
    const theme = themes.find(t => t.id === themeId);
    return { ...theme, order: index };
  });
}

async function saveThemeOrder() {
  try {
    const updates = themes.map(theme => ({
      id: theme.id,
      order: theme.order
    }));
    
    const { error } = await supabase
      .from('themes')
      .upsert(updates, { onConflict: 'id' });
      
    if (error) {
      console.error("Error saving theme order:", error);
      alert("Failed to save theme order");
    } else {
      alert("Theme order saved successfully");
    }
  } catch (error) {
    console.error("Error in saveThemeOrder:", error);
    alert("An error occurred while saving theme order");
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
  const newName = document.getElementById('edit-lesson-name').value;
  const newDifficulty = parseInt(document.getElementById('edit-lesson-difficulty').value);
  
  if (!newName || isNaN(newDifficulty)) {
    alert("Please provide valid values for name and difficulty");
    return;
  }
  
  try {
    const { error } = await supabase
      .from('lessons')
      .update({
        name: newName,
        difficulty: newDifficulty
      })
      .eq('id', currentLessonId);
      
    if (error) {
      console.error("Error updating lesson:", error);
      alert("Failed to update lesson");
      return;
    }
    
    // Update the lesson in the local array
    const lessonIndex = lessons.findIndex(l => l.id === currentLessonId);
    if (lessonIndex !== -1) {
      lessons[lessonIndex].name = newName;
      lessons[lessonIndex].difficulty = newDifficulty;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await supabase
      .from('schedules')
      .select('id, title')
      .eq('user_id', user.id);
      
    if (error) {
      console.error("Error loading saved schedules:", error);
      return;
    }
    
    const selector = document.getElementById('scheduleSelector');
    selector.innerHTML = '<option value="">Select a saved schedule</option>';
    
    data.forEach(schedule => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = schedule.title;
      selector.appendChild(option);
    });
  } catch (error) {
    console.error("Error in loadSavedSchedules:", error);
  }
}

async function loadSchedule(scheduleId) {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
      
    if (error) {
      console.error("Error loading schedule:", error);
      alert("Failed to load schedule");
      return;
    }
    
    currentSchedule = data.data;
    
    // Load lessons from the schedule
    const lessonNames = new Set();
    currentSchedule.forEach(entry => lessonNames.add(entry.lesson));
    
    // Fetch lesson details from the database
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .in('name', Array.from(lessonNames));
      
    if (lessonError) {
      console.error("Error loading lessons:", lessonError);
    } else {
      lessons = lessonData || [];
    }
    
    // Display on calendar
    displayScheduleOnCalendar(currentSchedule);
  } catch (error) {
    console.error("Error in loadSchedule:", error);
    alert("An error occurred while loading the schedule");
  }
}

function displayScheduleOnCalendar(scheduleData) {
  calendar.removeAllEvents();
  
  const events = scheduleData.map(entry => {
    // Find the lesson in our lessons array to get the ID
    const lesson = lessons.find(l => l.name === entry.lesson);
    const lessonId = lesson ? lesson.id : null;
    
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
        lessonId: lessonId
      }
    };
  });
  
  calendar.addEventSource(events);
}

async function uploadSchedule() {
  const title = document.getElementById('planTitle').value || "Untitled";
  const fileInput = document.getElementById('fileInput');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select a file to upload");
    return;
  }
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be logged in to upload a schedule");
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
      try {
        const scheduleData = JSON.parse(e.target.result);
        
        // Create lessons in the database if they don't exist
        const lessonNames = new Set();
        scheduleData.forEach(entry => lessonNames.add(entry.lesson));
        
        const lessonsToCreate = Array.from(lessonNames).map(name => {
          const entry = scheduleData.find(e => e.lesson === name);
          return {
            name,
            difficulty: entry.difficulty || 1,
            user_id: user.id,
            theme_id: null // We'll update this later when themes are assigned
          };
        });
        
        // Insert lessons
        if (lessonsToCreate.length > 0) {
          const { error: lessonError } = await supabase
            .from('lessons')
            .upsert(lessonsToCreate, { 
              onConflict: 'name,user_id',
              ignoreDuplicates: true 
            });
            
          if (lessonError) {
            console.error("Error creating lessons:", lessonError);
          }
        }
        
        // Save the schedule
        const { error } = await supabase
          .from('schedules')
          .insert([{
            title,
            user_id: user.id,
            data: scheduleData
          }]);
          
        if (error) {
          console.error("Error uploading schedule:", error);
          alert("Failed to upload schedule");
        } else {
          alert("Schedule uploaded successfully");
          loadSavedSchedules();
          
          // Display the uploaded schedule
          currentSchedule = scheduleData;
          displayScheduleOnCalendar(scheduleData);
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
        alert("Invalid JSON file");
      }
    };
    
    reader.readAsText(file);
  } catch (error) {
    console.error("Error in uploadSchedule:", error);
    alert("An error occurred while uploading the schedule");
  }
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
      if (a.theme && b.theme) {
        return a.theme.order - b.theme.order;
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
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
    
    // Get lessons from database
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .select('*, themes!inner(*)')
      .eq('user_id', user.id);
      
    if (lessonError) {
      console.error("Error loading lessons:", lessonError);
      alert("Failed to load lessons");
      return;
    }
    
    if (!lessonData || lessonData.length === 0) {
      alert("No lessons found. Please upload a schedule first.");
      return;
    }
    
    lessons = lessonData;
    
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
        const { error } = await supabase
          .from('schedules')
          .insert([{
            title,
            user_id: user.id,
            data: result.calendar,
            config: constants.toJSON()
          }]);
          
        if (error) {
          console.error("Error saving schedule:", error);
          alert("Failed to save schedule");
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
  document.getElementById('scheduleSelector').addEventListener('change', function() {
    const scheduleId = this.value;
    if (scheduleId) {
      loadSchedule(scheduleId);
    }
  });
  
  // Save theme order button
  document.getElementById('save-theme-order').addEventListener('click', saveThemeOrder);
  
  // Lesson edit modal
  document.getElementById('save-lesson-edit').addEventListener('click', saveLessonEdit);
  document.getElementById('cancel-lesson-edit').addEventListener('click', closeLessonEditModal);
  
  // Generate schedule button
  document.getElementById('generate-schedule').addEventListener('click', generateSchedule);
}
