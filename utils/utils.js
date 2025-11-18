export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};

export const getRecentUpdates = (participants) => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  return participants.filter(p =>
    p.LAST_MODIFIED && new Date(p.LAST_MODIFIED) > tenMinutesAgo
  );
};

export const sendData = async (participants, endpoint) => {
  try {
    const modified = getRecentUpdates(participants);

    if (modified.length === 0) {
      console.log("No recent changes to upload.");
      return;
    }

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants: modified }),
    });

    console.log(`Uploaded ${modified.length} changed participants.`);
  } catch (error) {
    console.error("Error sending updated participants:", error);
  }
};
