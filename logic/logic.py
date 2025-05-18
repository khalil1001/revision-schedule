import csv
from datetime import datetime, timedelta
from collections import defaultdict
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
import json
from datetime import timedelta
from collections import Counter


# Constants 
REVIEW_OFFSETS = [2, 7, 21, 42]
SECOND_REVIEW_DIFFICULTY = 0.5
MAX_DAILY_DIFFICULTY = 5
START_DATE = datetime(2025, 5, 24)
END_DATE = datetime(2025, 8, 31)

TOTAL_DAYS = 180  # total study span (days)
certifs = [
    "Psychiatrie",
    "Gynéco",
    "Orl/ophtalmo",
    "Chir",
    "Neuro",
    "Cardio",
    "Gastro",
    "Pneumo",
    "Endocrino",
    "Hemato",
    "Infectieux",
    "Nephro",
    "Ortho/rhum",
    "Pédiatrie",
    "Rea",
    "Uro"
]

# Load lessons from CSV
def load_lessons_from_csv(file_path):
    lessons = []
    with open(file_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        next(reader)  # skip header
        next(reader)  # skip empty row
        for row in reader:
            name = str(row[0]).strip()
            try:
                difficulty = int(row[1])
                lessons.append({"name": name, "difficulty": difficulty})
            except (ValueError, IndexError):
                print(f"❌ Invalid row: {row}")
                continue
    return lessons

# Scheduling algorithm
def generate_schedule(lessons):
    calendar = defaultdict(list)
    daily_difficulty = defaultdict(float)
    lesson_dates = {}
    
    lessons_queue = lessons.copy()
    for i, lesson in enumerate(lessons_queue):
        lesson["index"] = i  # Ensure original order is preserved

    pending_reviews = []
    current_lesson_index = 0
    day = START_DATE

    while current_lesson_index < len(lessons_queue) or pending_reviews:
        # Step 1: Schedule NEW lessons only if not Sunday
        if current_lesson_index < len(lessons_queue) and day.weekday() != 6:
            lesson = lessons_queue[current_lesson_index]
            if daily_difficulty[day] + lesson["difficulty"] <= MAX_DAILY_DIFFICULTY:
                calendar[day].append(f'NEW: {lesson["name"]}')
                daily_difficulty[day] += lesson["difficulty"]
                lesson_dates[lesson["name"]] = day

                # Queue reviews
                for offset in REVIEW_OFFSETS:
                    review_day = day + timedelta(days=offset)
                    pending_reviews.append({
                        "lesson": lesson,
                        "target_date": review_day,
                        "offset": offset
                    })
                current_lesson_index += 1

        # Step 2: Schedule reviews (even on Sundays)
        pending_reviews.sort(key=lambda r: -r["lesson"]["difficulty"])
        remaining_reviews = []
        for review in pending_reviews:
            if review["target_date"] <= day:
                review_difficulty = SECOND_REVIEW_DIFFICULTY * review["lesson"]["difficulty"]
                if daily_difficulty[day] + review_difficulty <= MAX_DAILY_DIFFICULTY:
                    calendar[day].append(f'REVIEW: {review["lesson"]["name"]}')
                    daily_difficulty[day] += review_difficulty
                else:
                    remaining_reviews.append(review)
            else:
                remaining_reviews.append(review)
        pending_reviews = remaining_reviews

        day += timedelta(days=1)

    print(f"⚠️ Number of reviews not scheduled: {len(pending_reviews)}")
    for r in pending_reviews[:10]:
        print(f"  ❌ {r['lesson']['name']} | difficulty {r['lesson']['difficulty']} | offset {r['offset']} | target {r['target_date'].strftime('%Y-%m-%d')}")

    return calendar, daily_difficulty, lesson_dates, pending_reviews

def generate_schedule_fill_gaps(lessons):
    from collections import defaultdict

    calendar = defaultdict(list)
    daily_difficulty = defaultdict(float)
    lesson_dates = {}
    pending_reviews = []

    START_DATE = datetime(2025, 5, 30)
    END_DATE = datetime(2025, 8, 31)

    current_date = START_DATE
    all_days = []

    # Precompute all days up to END_DATE
    while current_date <= END_DATE:
        if current_date.weekday() != 6:  # skip Sunday
            all_days.append(current_date)
        current_date += timedelta(days=1)

    # Phase 1: Schedule lessons in order, try to fit into existing partial days
    for lesson in lessons:
        placed = False
        for day in all_days:
            # Count how many new lessons already on that day
            new_lesson_count = sum(1 for item in calendar[day] if item.startswith("NEW:"))
            if (
                new_lesson_count < 2 and
                daily_difficulty[day] + lesson["difficulty"] <= MAX_DAILY_DIFFICULTY
            ):
                calendar[day].append(f'NEW: {lesson["name"]}')
                daily_difficulty[day] += lesson["difficulty"]
                lesson_dates[lesson["name"]] = day

                for offset in REVIEW_OFFSETS:
                    pending_reviews.append({
                        "lesson": lesson,
                        "target_date": day + timedelta(days=offset),
                        "offset": offset
                    })
                placed = True
                break

        if not placed:
            print(f"⚠️ Could not schedule lesson: {lesson['name']}")

    # Phase 2: Schedule Reviews
    final_review_day = END_DATE + timedelta(days=max(REVIEW_OFFSETS) + 7)
    day = START_DATE
    unscheduled_reviews = []

    while day <= final_review_day or pending_reviews:
        pending_reviews.sort(key=lambda r: (-r["lesson"]["difficulty"], r["target_date"]))
        remaining_reviews = []

        for review in pending_reviews:
            if review["target_date"] <= day:
                # Count how many reviews are already scheduled that day
                review_count = sum(1 for item in calendar[day] if item.startswith("REVIEW:"))
                review_difficulty = review["lesson"]["difficulty"] * SECOND_REVIEW_DIFFICULTY

                if (
                    review_count < 5 and
                    daily_difficulty[day] + review_difficulty <= MAX_DAILY_DIFFICULTY
                ):
                    calendar[day].append(f'REVIEW: {review["lesson"]["name"]} ({review["offset"]}-day)')
                    daily_difficulty[day] += review_difficulty
                else:
                    remaining_reviews.append(review)
            else:
                remaining_reviews.append(review)

        pending_reviews = remaining_reviews
        day += timedelta(days=1)

    print(f"✅ Lessons scheduled: {len(lesson_dates)} / {len(lessons)}")
    print(f"📚 Last lesson on: {max(lesson_dates.values()).strftime('%Y-%m-%d')}")
    print(f"⚠️ Unscheduled reviews: {len(pending_reviews)}")
    return calendar, daily_difficulty, lesson_dates, pending_reviews



# Summarize unscheduled reviews by lesson difficulty
def summarize_unscheduled_reviews(unscheduled_reviews):
    lesson_difficulty_map = {}
    for entry in unscheduled_reviews:
        key = (entry["lesson"], entry["difficulty"])
        lesson_difficulty_map[key] = entry["difficulty"]  # Ensure unique lessons

    # Count how many unique lessons per difficulty
    difficulty_counts = Counter(d for _, d in lesson_difficulty_map.items())

    print("\n📊 Summary of unscheduled reviews by difficulty:")
    for diff, count in sorted(difficulty_counts.items()):
        print(f"  - {count} lessons of difficulty {diff} had at least one unscheduled review")


# Display the schedule
def print_schedule(calendar, daily_difficulty, lesson_dates):
    from colorama import Fore, Style, init
    init(autoreset=True)  # Auto-reset after each print for safety

    for day in sorted(calendar.keys()):
        print(f"{Fore.YELLOW}{day} ({len(calendar[day])} items, total difficulty: {daily_difficulty[day]})")
        for item in calendar[day]:
            if item.startswith("NEW:"):
                print(f"  {Fore.GREEN}📘 NEW → {item[5:]}")
            elif item.startswith("REVIEW:"):
                lesson_name = item[8:]
                # Try to match this review to an offset (for display)
                review_label = ""
                for offset in REVIEW_OFFSETS:
                    if day == (lesson_dates[lesson_name] + timedelta(days=offset)):
                        review_label = f"{offset}-day review"
                        break
                print(f"  {Fore.CYAN}🔁 REVIEW → {lesson_name} ({review_label})")
        print()

        
# Prepare data for visualization
def prepare_visual_data(calendar):
    data = []
    for date, tasks in calendar.items():
        for task in tasks:
            task_type = 'Review' if 'REVIEW' in task else 'New'
            lesson_name = task.replace('REVIEW: ', '').replace('NEW: ', '')
            data.append({
                "Date": date,
                "Task": lesson_name,
                "Type": task_type
            })
    return pd.DataFrame(data)

def plot_calendar(df):
    fig, ax = plt.subplots(figsize=(15, 6))
    colors = {'New': 'blue', 'Review': 'green'}

    df['Date'] = pd.to_datetime(df['Date'])
    df['Y'] = df['Type'].apply(lambda x: 1 if x == 'New' else 0)

    ax.scatter(df['Date'], df['Y'], c=df['Type'].map(colors), label=df['Type'], alpha=0.7)

    ax.set_yticks([0, 1])
    ax.set_yticklabels(['Review', 'New'])
    ax.set_title("Study Plan: New Lessons vs. Reviews")
    ax.set_xlabel("Date")
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=1))
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %d'))

    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.legend(colors)
    plt.grid(True)
    plt.show()

def export_schedule(calendar, daily_difficulty, lesson_dates, output_prefix="study_schedule"):

    schedule_data = []
    for day in sorted(calendar.keys()):
        for item in calendar[day]:
            entry = {
                "date": day.isoformat(),
                "type": "NEW" if item.startswith("NEW:") else "REVIEW",
                "lesson": item.split(": ")[1],
                "difficulty": daily_difficulty[day],  # total difficulty of the day
                "review_label": None
            }

            if entry["type"] == "REVIEW":
                lesson_start = lesson_dates.get(entry["lesson"])
                if lesson_start:
                    delta_days = (day - lesson_start).days
                    entry["review_label"] = f"{delta_days}-day review"

            schedule_data.append(entry)

    # Save as JSON
    json_file = f"{output_prefix}.json"
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump(schedule_data, f, indent=2, ensure_ascii=False)


    print(f"✅ Exported to:\n  - {json_file}")

# --- Main execution ---
csv_file_path = 'liste-des-cours.csv'  # Replace with your actual file path
lessons = load_lessons_from_csv(csv_file_path)
calendar, daily_difficulty,lesson_dates, unscheduled_reviews = generate_schedule_fill_gaps(lessons)
#print_schedule(calendar, daily_difficulty,lesson_dates)

export_schedule(calendar, daily_difficulty,lesson_dates)