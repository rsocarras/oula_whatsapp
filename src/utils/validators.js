export const validateMessage = (to, text) => {
  if (!to || !text) {
    return { 
      valid: false, 
      message: 'to and text are required' 
    }
  }

  if (typeof text !== 'string' || text.trim().length === 0) {
    return { 
      valid: false, 
      message: 'text must be a non-empty string' 
    }
  }

  if (typeof to !== 'string' || to.trim().length === 0) {
    return { 
      valid: false, 
      message: 'to must be a valid phone number or JID' 
    }
  }

  return { valid: true }
}