export const MISSION_FORMAT_MISSION = "mission";
export const MISSION_FORMAT_EMAIL = "incoming_email";

export const normalizeMissionFormat = (value) =>
  value === MISSION_FORMAT_EMAIL ? MISSION_FORMAT_EMAIL : MISSION_FORMAT_MISSION;

export const getMissionFormatCopy = (value) => {
  const format = normalizeMissionFormat(value);

  if (format === MISSION_FORMAT_EMAIL) {
    return {
      format,
      adminToggleLabel: "Incoming Email",
      titleLabel: "Subject Line",
      titlePlaceholder: "e.g. Quick Request: Studio Feedback Needed",
      instructionLabel: "Body",
      instructionPlaceholder: "Write the email body and include the task instructions.",
      codeLabel: "Verification Code",
      codeHelper: "Students will see this as Reply with verification code.",
      codePlaceholder: "REPLY CODE",
      submitLabel: "Deploy Email",
      listBadge: "Incoming Email",
      studentBadge: "Incoming Email",
      studentCodeLabel: "Reply with verification code",
      studentCodePlaceholder: "TYPE VERIFICATION CODE...",
      studentButtonLabel: "Send Reply + Claim Reward",
      incorrectCodeMessage: "INCORRECT VERIFICATION CODE."
    };
  }

  return {
    format,
    adminToggleLabel: "Mission",
    titleLabel: "Mission Title",
    titlePlaceholder: "e.g. Operation: Deep Freeze",
    instructionLabel: "Briefing / Instructions",
    instructionPlaceholder: "Describe the objective...",
    codeLabel: "Secret Code (Optional)",
    codeHelper: "Leave blank if students should be able to claim without a code.",
    codePlaceholder: "LEAVE BLANK FOR NONE",
    submitLabel: "Deploy Mission",
    listBadge: "Mission",
    studentBadge: "Priority Message",
    studentCodeLabel: "Input Security Code",
    studentCodePlaceholder: "ENTER CODE WORD...",
    studentButtonLabel: "Claim Reward",
    incorrectCodeMessage: "INCORRECT PASSCODE."
  };
};
