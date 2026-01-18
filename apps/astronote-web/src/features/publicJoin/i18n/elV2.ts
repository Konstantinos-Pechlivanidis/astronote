export const joinCopyV2 = {
  headline: 'Εγγραφή για οφέλη μέλους',
  subheadline: 'Λάβετε προσφορές, ενημερώσεις και αποκλειστικά προνόμια από αυτό το κατάστημα.',
  trustLine: 'Χωρίς spam. Διαγραφή οποιαδήποτε στιγμή.',
  cta: 'Εγγραφή',
  submitting: 'Εγγραφή...',
  fields: {
    firstName: 'Όνομα',
    lastName: 'Επώνυμο (προαιρετικό)',
    phoneCountry: '+30',
    phone: 'Κινητό τηλέφωνο',
    email: 'Email (προαιρετικό)',
    gender: 'Φύλο (προαιρετικό)',
    birthday: 'Ημερομηνία γέννησης (προαιρετικό)',
  },
  benefits: [
    {
      icon: 'check' as const,
      title: 'Αποκλειστικές εκπτώσεις',
      description: 'Τα μέλη έχουν καλύτερες τιμές και περιορισμένες προσφορές.',
    },
    {
      icon: 'zap' as const,
      title: 'Πρώτη πρόσβαση',
      description: 'Μάθετε πρώτοι για νέα προϊόντα.',
    },
    {
      icon: 'bell' as const,
      title: 'Σημαντικές ενημερώσεις',
      description: 'Μόνο σημαντικές ανακοινώσεις.',
    },
    {
      icon: 'logout' as const,
      title: 'Εύκολη διαγραφή',
      description: 'Διαγραφή οποιαδήποτε στιγμή με 1 tap.',
    },
  ],
  successTitle: 'Επιτυχής εγγραφή ✓',
  successMessage: 'Θα λαμβάνετε πλέον οφέλη μέλους και ενημερώσεις.',
  invalidTitle: 'Μη διαθέσιμος σύνδεσμος',
  invalidMessage: 'Αυτός ο σύνδεσμος εγγραφής δεν είναι έγκυρος ή έχει λήξει.',
  rateLimitTitle: 'Πάρα πολλές προσπάθειες',
  rateLimitMessage: 'Παρακαλώ περιμένετε λίγο και δοκιμάστε ξανά.',
  loading: 'Φόρτωση...',
  errorMessage: 'Κάτι πήγε στραβά. Παρακαλώ δοκιμάστε ξανά.',
} as const;

// Default content for merchant override fallbacks
export const DEFAULT_HEADLINE_EL = 'Εγγραφή για οφέλη μέλους';
export const DEFAULT_SUBHEADLINE_EL = 'Λάβετε προσφορές, ενημερώσεις και αποκλειστικά προνόμια από αυτό το κατάστημα.';
export const DEFAULT_BULLETS_EL = [
  'Αποκλειστικές εκπτώσεις — Τα μέλη έχουν καλύτερες τιμές και περιορισμένες προσφορές.',
  'Πρώτη πρόσβαση — Μάθετε πρώτοι για νέα προϊόντα.',
  'Σημαντικές ενημερώσεις — Μόνο σημαντικές ανακοινώσεις.',
  'Εύκολη διαγραφή — Διαγραφή οποιαδήποτε στιγμή με 1 tap.',
];
