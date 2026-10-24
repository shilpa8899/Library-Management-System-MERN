const cron = require('node-cron');
const Borrowing = require('../models/Borrowing');
const { createNotification, sendEmail } = require('../services/notificationService');

function startDueDateReminders() {
  // Runs daily at 8:00 AM in the server's local timezone.
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date();
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const dueSoon = await Borrowing.find({
        status: 'borrowed',
        returnDate: { $gte: now, $lte: twoDaysFromNow },
        reminderSentAt: { $exists: false },
      }).populate('user', 'name email').populate('book', 'title');

      for (const record of dueSoon) {
        if (!record.user || !record.book) continue;
        const message = `Please return "${record.book.title}" by ${new Date(record.returnDate).toLocaleDateString()}.`;
        await createNotification({ user: record.user._id, title: 'Book due soon', message, type: 'due-soon' });
        await sendEmail({ to: record.user.email, subject: 'Library book due-date reminder', text: `${record.user.name || 'Hello'},\n\n${message}` });
        record.reminderSentAt = new Date();
        await record.save();
      }

      const overdueRecords = await Borrowing.find({
        status: { $in: ['borrowed', 'overdue'] },
        returnDate: { $lt: now },
        overdueNoticeSentAt: { $exists: false },
      }).populate('user', 'name email').populate('book', 'title');

      for (const record of overdueRecords) {
        if (!record.user || !record.book) continue;
        const message = `The return date for "${record.book.title}" has passed. Please return it as soon as possible.`;
        await createNotification({ user: record.user._id, title: 'Book overdue', message, type: 'overdue' });
        await sendEmail({ to: record.user.email, subject: 'Library overdue book notice', text: `${record.user.name || 'Hello'},\n\n${message}` });
        record.status = 'overdue';
        record.overdueNoticeSentAt = new Date();
        await record.save();
      }
    } catch (error) {
      console.error('Due-date reminder job failed:', error.message);
    }
  });
}

module.exports = startDueDateReminders;
