/**
 * @fileoverview General Utility Functions
 *
 * WHY This File:
 * - Central location for shared utility functions
 * - Tailwind CSS class merging with clsx for conditional styling
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 *
 * WHY twMerge + clsx:
 * - clsx: Conditional class names with clean syntax
 * - twMerge: Resolves Tailwind class conflicts (e.g., "p-4 p-8" → "p-8")
 * - Prevents specificity issues in component styling
 *
 * @param inputs - Class names, conditional classes, arrays
 * @returns Merged class string
 *
 * @example
 * ```typescript
 * cn('px-4 py-2', isActive && 'bg-blue-500', {'text-white': isActive})
 * // Result: "px-4 py-2 bg-blue-500 text-white" (if isActive is true)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
