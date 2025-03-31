export const validateRequiredFieldsWithResult = (
  fields: Record<string, any>,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } => {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!fields[field]) {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};
