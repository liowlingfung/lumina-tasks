import { GoogleGenAI, Type } from "@google/genai";
import { Todo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini to break down a complex task into smaller subtasks.
 */
export const generateSubtasks = async (taskText: string): Promise<string[]> => {
  try {
    const model = "gemini-2.5-flash";
    const prompt = `
      You are an expert productivity assistant. 
      Break down the following task into 3 to 5 concrete, actionable, and concise subtasks.
      Task: "${taskText}"
      
      Return ONLY a JSON array of strings.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error generating subtasks:", error);
    return [];
  }
};

/**
 * Uses Gemini to prioritize/sort the list of todos based on implied urgency and importance.
 */
export const smartSortTodos = async (todos: Todo[]): Promise<string[]> => {
  if (todos.length < 2) return todos.map(t => t.id);

  try {
    const model = "gemini-2.5-flash";
    const todoListString = todos.map(t => JSON.stringify({ id: t.id, text: t.text })).join("\n");
    
    const prompt = `
      You are an expert project manager. Sort the following tasks by implied priority (Urgency/Importance).
      Put urgent/critical tasks first. Put casual/someday tasks last.
      
      Tasks:
      ${todoListString}
      
      Return ONLY a JSON array of the task IDs in the new sorted order.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) return todos.map(t => t.id);

    const sortedIds = JSON.parse(jsonStr);
    return Array.isArray(sortedIds) ? sortedIds : todos.map(t => t.id);
  } catch (error) {
    console.error("Error sorting todos:", error);
    return todos.map(t => t.id);
  }
};