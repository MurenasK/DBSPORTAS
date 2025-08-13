export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

export const getRecentUpdates = (participants) => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  return participants.filter(p =>
    p.LAST_MODIFIED && new Date(p.LAST_MODIFIED) > tenMinutesAgo
  );
}

export const sendData = async (participants) => {
  try {
    const modifiedParticipants = participants.filter(p => p.LAST_MODIFIED);
    if (modifiedParticipants.length === 0) return; // Skip if no changes

    await fetch("YOUR_API_ENDPOINT", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants: modifiedParticipants }),
    });

    console.log("Data sent successfully!");
  } catch (error) {
    console.error("Error sending data:", error);
  }
};