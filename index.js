const { App } = require("@slack/bolt");
require("dotenv").config();
const axios = require("axios");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.APP_TOKEN
});

(async () => {
  const port = 3000;
  await app.start(process.env.PORT || port);
  console.log('Salah Bot Started!');
})();

const activeRequests = {};

app.message("!salah", async ({ message, say }) => {
  try {
    const userId = message.user;

    if (activeRequests[userId]) {
      await say("You already have an active request. Please provide the city name or wait for the current request to complete.");
      return;
    }

    activeRequests[userId] = { awaitingCity: true };

    await say("As salamu alaykum! Please provide a city name:");

    const conversationTimeout = setTimeout(async () => {
      if (activeRequests[userId]?.awaitingCity) {
        delete activeRequests[userId];
        await say("Your request has timed out. Please try again.");
      }
    }, 60000);

    // Listen for subsequent messages
    await app.message(async ({ message: newMessage }) => {
      if (newMessage.user === userId && activeRequests[userId]?.awaitingCity) {
        const city = newMessage.text;
        const country = 'US';
        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        const url = `http://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${city}&country={US}`;

        try {
          const apiResponse = await axios.get(url);
          const data = apiResponse.data.data[parseInt(day) - 1].timings;

          const currentHour = date.getHours();
          let nextSalah = null;
          for (const salah in data) {
            const salahTime = data[salah].split(":")[0];
            if (parseInt(salahTime) > currentHour) {
              nextSalah = `${salah}: ${data[salah]}`;
              break;
            }
          }

          if (nextSalah) {
            await say(`Next salah time for ${city} is:\n${nextSalah}`);

            await say("Would you like to see the list of the salah times for today? (Y/N)");

            clearTimeout(conversationTimeout);

            const responseListener = async ({ message: responseMessage }) => {
              if (responseMessage.user === userId && ['Y', 'N'].includes(responseMessage.text.toUpperCase())) {
                if (responseMessage.text.toUpperCase() === 'Y') {
                  let salahTimesText = `Salah times for ${city} today:\n`;
                  const specificsalahs = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
                  for (const salah of specificsalahs) {
                    if (data[salah]) {
                      salahTimesText += `${salah}: ${data[salah]}\n`;
                    }
                  }
                  await say(salahTimesText);
                } else {
                  await say("Okay, no problem. As salamu alaykum!");
                }

                delete activeRequests[userId];

                app.removeListener("message", responseListener);
              }
            };

            app.message(responseListener);
          }
        } catch (error) {
          await say("Sorry, I couldn't retrieve the salah times. Please make sure the city is in the US and try again.");
          console.error(error);

          delete activeRequests[userId];
        }
      }
    });

  } catch (error) {
    console.log("Error occurred:");
    console.error(error);
  }
});
