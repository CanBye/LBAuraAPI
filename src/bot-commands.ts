import { Message, EmbedBuilder } from "discord.js";
import { v4 as uuidv4 } from "uuid";
import { setKV, deleteKV, setApiKey, getKVCount } from "./store";
import { config } from "./config";

const KV_MAX_PAIRS = 512;
const KV_MAX_KEY_LENGTH = 255;
const KV_MAX_VALUE_LENGTH = 30000;

export async function handleCommand(message: Message): Promise<void> {
  const content = message.content.trim();
  if (!content.startsWith(".")) return;

  const args = content.slice(1).split(/\s+/);
  const command = args.shift()?.toLowerCase();

  switch (command) {
    case "me": {
      const userId = message.author.id;
      const base = config.apiBaseUrl;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: message.author.displayName || message.author.username,
          iconURL: message.author.displayAvatarURL({ size: 64 }),
        })
        .setTitle("🔗 Your LBAuraAPI Profile")
        .setDescription(`Here's your API endpoint and links.`)
        .addFields(
          { name: "API URL", value: `\`\`\`\n${base}/v1/users/${userId}\n\`\`\``, inline: false },
          { name: "WebSocket", value: `\`\`\`\nws://${base.replace(/^https?:\/\//, "")}/socket\n\`\`\``, inline: false },
          { name: "Demo Page", value: `[Open Demo](${base}/demo)`, inline: true },
          { name: "User ID", value: `\`${userId}\``, inline: true },
        )
        .setFooter({ text: "LBAuraAPI" })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      break;
    }

    case "apikey": {
      const key = uuidv4();
      setApiKey(message.author.id, key);
      try {
        await message.author.send(`Your API key: \`${key}\`\nKeep this secret!`);
        if (message.guild) {
          await message.reply("API key sent via DM!");
        }
      } catch {
        await message.reply("Could not send DM. Please enable DMs from server members.");
      }
      break;
    }

    case "set": {
      const key = args[0];
      const value = args.slice(1).join(" ");

      if (!key || !value) {
        await message.reply("Usage: `.set <key> <value>`");
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        await message.reply("Key must be alphanumeric (a-zA-Z0-9_).");
        return;
      }
      if (key.length > KV_MAX_KEY_LENGTH) {
        await message.reply(`Key must be ${KV_MAX_KEY_LENGTH} characters or less.`);
        return;
      }
      if (value.length > KV_MAX_VALUE_LENGTH) {
        await message.reply(`Value must be ${KV_MAX_VALUE_LENGTH} characters or less.`);
        return;
      }

      const count = getKVCount(message.author.id);
      if (count >= KV_MAX_PAIRS) {
        await message.reply(`Maximum of ${KV_MAX_PAIRS} KV pairs reached.`);
        return;
      }

      setKV(message.author.id, key, value);
      await message.reply(`Set \`${key}\` successfully.`);
      break;
    }

    case "del":
    case "delete": {
      const key = args[0];
      if (!key) {
        await message.reply("Usage: `.del <key>`");
        return;
      }
      deleteKV(message.author.id, key);
      await message.reply(`Deleted \`${key}\`.`);
      break;
    }

    case "help": {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📖 LBAuraAPI Commands")
        .setDescription(
          "`.me` — Your API URL and profile links\n" +
          "`.apikey` — Generate your API key (sent via DM)\n" +
          "`.set <key> <value>` — Set a KV pair\n" +
          "`.del <key>` — Delete a KV pair\n" +
          "`.help` — Show this message"
        )
        .setFooter({ text: "LBAuraAPI" })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      break;
    }
  }
}
