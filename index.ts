import * as tls from 'tls';
import * as fs from 'fs';

// Configuration parameters loaded from environment variables (with robust fallbacks)
const SSL_PORT = parseInt(process.env.SSL_CHECK_PORT || '443', 10);
const SSL_TIMEOUT = parseInt(process.env.SSL_CHECK_TIMEOUT || '5000', 10);
const SSL_WARN_DAYS = parseInt(process.env.SSL_CHECK_WARN_DAYS || '14', 10);

// Interface for SSL result data structure
interface SSLResult {
  domain: string;
  expiredDate: string;
  remainingDays: string;
  status: string;
}

// Helper to calculate visual string width (Corrects for emoji width differences)
const getVisualWidth = (str: string): number => {
  return str
    .replace(/✅/g, '  ')
    .replace(/🔴/g, '  ')
    .replace(/⚠️/g, '  ')
    .replace(/❌/g, '  ')
    .replace(/⏱️/g, '  ').length;
};

// Helper to append spaces (padding) based on visual width
const padEndVisual = (str: string, targetWidth: number): string => {
  const currentWidth = getVisualWidth(str);
  const missing = targetWidth - currentWidth;
  return str + ' '.repeat(missing > 0 ? missing : 0);
};

// Function to check SSL of a single domain
const checkSSL = (domain: string): Promise<SSLResult> => {
  return new Promise((resolve) => {
    const options: tls.ConnectionOptions = {
      host: domain,
      port: SSL_PORT,
      servername: domain,
      rejectUnauthorized: false
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();

      if (!cert || Object.keys(cert).length === 0) {
        socket.end();
        resolve({
          domain,
          expiredDate: '-',
          remainingDays: '-',
          status: '❌ CERTIFICATE ERROR'
        });
        return;
      }

      const identityError = tls.checkServerIdentity(domain, cert);
      if (identityError) {
        socket.end();
        resolve({
          domain,
          expiredDate: '-',
          remainingDays: '-',
          status: '❌ INVALID'
        });
        return;
      }

      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysRemaining = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Format date to DD-MM-YYYY
      const day = String(validTo.getDate()).padStart(2, '0');
      const month = String(validTo.getMonth() + 1).padStart(2, '0');
      const year = validTo.getFullYear();
      const formattedDate = `${day}-${month}-${year}`;

      let status = '✅ SAFE';
      if (daysRemaining < 0) {
        status = '🔴 EXPIRED';
      } else if (daysRemaining <= SSL_WARN_DAYS) {
        status = '⚠️ UPDATE SOON';
      }

      socket.end();
      resolve({
        domain,
        expiredDate: formattedDate,
        remainingDays: daysRemaining < 0 ? `${Math.abs(daysRemaining)} days ago` : `${daysRemaining} days`,
        status
      });
    });

    socket.on('error', (err) => {
      resolve({
        domain,
        expiredDate: '-',
        remainingDays: '-',
        status: '❌ ERROR'
      });
    });

    socket.setTimeout(SSL_TIMEOUT, () => {
      socket.destroy();
      resolve({
        domain,
        expiredDate: '-',
        remainingDays: '-',
        status: '⏱️ TIMEOUT'
      });
    });
  });
};

// Main Function
const main = async () => {
  const fileName = Bun.argv[2];

  if (!fileName) {
    console.error("❌ Error: Please provide a target domain list file!");
    console.log("💡 Example usage: bun check-ssl domain.txt");
    return;
  }

  try {
    // Dynamically read file based on input argument
    if (!fs.existsSync(fileName)) {
      console.error(`❌ Error: File "${fileName}" not found.`);
      return;
    }

    const fileContent = fs.readFileSync(fileName, 'utf-8');
    const domains = fileContent
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    console.log(`Checking SSL for a total of ${domains.length} domains from file [${fileName}]`);

    // Define column widths
    const noW = 4;
    const domW = Math.max(...domains.map(d => d.length), 6) + 2;
    const dateW = 17;
    const daysW = 15;
    const statW = 20;

    // Create table borders
    const topBorder = `┌${'─'.repeat(noW + 2)}┬${'─'.repeat(domW + 2)}┬${'─'.repeat(dateW + 2)}┬${'─'.repeat(daysW + 2)}┬${'─'.repeat(statW + 2)}┐`;
    const midBorder = `├${'─'.repeat(noW + 2)}┼${'─'.repeat(domW + 2)}┼${'─'.repeat(dateW + 2)}┼${'─'.repeat(daysW + 2)}┼${'─'.repeat(statW + 2)}┤`;
    const botBorder = `└${'─'.repeat(noW + 2)}┴${'─'.repeat(domW + 2)}┴${'─'.repeat(dateW + 2)}┴${'─'.repeat(daysW + 2)}┴${'─'.repeat(statW + 2)}┘`;

    // Print table header
    console.log(topBorder);
    console.log(`│ ${padEndVisual('No', noW)} │ ${padEndVisual('Domain', domW)} │ ${padEndVisual('Expiration Date', dateW)} │ ${padEndVisual('Days Remaining', daysW)} │ ${padEndVisual('Status', statW)} │`);
    console.log(midBorder);

    // Loop through data and print row by row
    let index = 1;
    for (const domain of domains) {
      const result = await checkSSL(domain);

      const row = `│ ${padEndVisual(index.toString(), noW)} │ ${padEndVisual(result.domain, domW)} │ ${padEndVisual(result.expiredDate, dateW)} │ ${padEndVisual(result.remainingDays, daysW)} │ ${padEndVisual(result.status, statW)} │`;
      console.log(row);

      index++;
    }

    // Print table footer
    console.log(botBorder);

  } catch (error: any) {
    console.error("System error occurred:", error.message);
  }
};

main();
