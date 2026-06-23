import { FamEvent } from "@/types/events";

const today = new Date();
const fmt = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
};

export const SAMPLE_EVENTS: FamEvent[] = [
  {
    id: "1",
    title: "School drop-off",
    description: "Don't forget lunch box and library book",
    date: fmt(0),
    time: "08:15",
    category: "school",
    childName: "Emma",
    isCompleted: false,
  },
  {
    id: "2",
    title: "Soccer practice",
    description: "Bring shin guards and water bottle",
    date: fmt(0),
    time: "16:00",
    category: "sports",
    childName: "Liam",
    isCompleted: false,
  },
  {
    id: "3",
    title: "Dentist appointment",
    description: "Annual check-up at Dr. Smith's",
    date: fmt(1),
    time: "10:30",
    category: "medical",
    childName: "Emma",
    isCompleted: false,
  },
  {
    id: "4",
    title: "Birthday party",
    description: "Jake's party at Bounce World. Gift wrapped!",
    date: fmt(2),
    time: "14:00",
    category: "social",
    childName: "Liam",
    isCompleted: false,
  },
  {
    id: "5",
    title: "Parent-teacher conference",
    date: fmt(3),
    time: "15:30",
    category: "school",
    childName: "Emma",
    isCompleted: false,
  },
  {
    id: "6",
    title: "Swimming lessons",
    description: "New term starts - bring registration form",
    date: fmt(0),
    time: "17:30",
    category: "sports",
    childName: "Emma",
    isCompleted: true,
  },
  {
    id: "7",
    title: "Pick up school photos",
    date: fmt(4),
    category: "school",
    isCompleted: false,
  },
  {
    id: "8",
    title: "Flu vaccination",
    date: fmt(5),
    time: "09:00",
    category: "medical",
    childName: "Liam",
    isCompleted: false,
  },
  {
    id: "9",
    title: "Playdate with Mia",
    date: fmt(1),
    time: "15:00",
    category: "social",
    childName: "Emma",
    isCompleted: false,
  },
  {
    id: "10",
    title: "Book fair at school",
    date: fmt(6),
    time: "09:00",
    category: "school",
    isCompleted: false,
  },
];
