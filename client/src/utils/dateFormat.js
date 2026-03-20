/**
 * Date formatting utilities for Indian format (DD/MM/YYYY)
 */

/**
 * Format date to Indian format DD/MM/YYYY
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string
 */
export const formatToIndianDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format date to input value format (YYYY-MM-DD) from Indian format
 * @param {string} indianDate - Date in DD/MM/YYYY format
 * @returns {string} Date in YYYY-MM-DD format for input
 */
export const indianDateToInputValue = (indianDate) => {
  if (!indianDate) return '';
  
  const [day, month, year] = indianDate.split('/');
  return `${year}-${month}-${day}`;
};

/**
 * Format date input value to Indian display format
 * @param {string} inputValue - Date in YYYY-MM-DD format
 * @returns {string} Date in DD/MM/YYYY format
 */
export const inputValueToIndianDate = (inputValue) => {
  if (!inputValue) return '';
  
  const [year, month, day] = inputValue.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Get today's date in Indian format
 * @returns {string} Today's date in DD/MM/YYYY format
 */
export const getTodayIndian = () => {
  return formatToIndianDate(new Date());
};

/**
 * Get today's date in input format (YYYY-MM-DD)
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Format date with time in Indian format
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date and time string
 */
export const formatToIndianDateTime = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const dateStr = formatToIndianDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${dateStr} ${hours}:${minutes}`;
};
