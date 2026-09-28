/* Invoice Maker — static data: labels, defaults, block catalogue and samples. */
(function () {
  'use strict';

  // Labels printed on the document, per language.
  const LABELS = {
    en: {
      docTitle: 'Invoice',
      date: 'Date',
      number: 'Invoice no',
      phone: 'Phone no',
      email: 'Email',
      billedTo: 'Billed to',
      desc: 'Service',
      qty: 'Quantity',
      price: 'Price',
      total: 'Total',
      subtotal: 'Subtotal',
      discount: 'Discount',
      tax: 'VAT',
      deposit: 'Advance payment',
      balance: 'Balance due',
      grandTotal: 'Total invoice amount',
      paymentTitle: 'Amount shall be transferred to our bank details',
      accName: 'Name',
      accNo: 'Account No',
      bank: 'Bank',
      phoneTransfer: 'Transfer by phone number',
      regards: 'Best Regards',
      clientSig: 'Client signature',
      thanks: 'Thank you, always at your service.',
      listTitle: 'Scope of work',
      fieldsTitle: 'Details',
      heading: 'Project title',
      page: 'Page'
    },
    ar: {
      docTitle: 'فاتورة عمل',
      date: 'التاريخ',
      number: 'رقم الفاتورة',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      billedTo: 'العميل',
      desc: 'العمل المنفذ',
      qty: 'الكمية',
      price: 'السعر',
      total: 'الإجمالي',
      subtotal: 'المجموع الفرعي',
      discount: 'الخصم',
      tax: 'ضريبة القيمة المضافة',
      deposit: 'الدفعة المقدمة',
      balance: 'المبلغ المتبقي',
      grandTotal: 'المجموع',
      paymentTitle: 'طرق الدفع',
      accName: 'الاسم',
      accNo: 'رقم الحساب',
      bank: 'البنك',
      phoneTransfer: 'التحويل عبر رقم الهاتف',
      regards: 'مع خالص التحية',
      clientSig: 'توقيع العميل',
      thanks: 'شكرًا لكـــــم، دائمًا بخدمتكم.',
      listTitle: 'نطاق العمل',
      fieldsTitle: 'تفاصيل',
      heading: 'عنوان المشروع',
      page: 'صفحة'
    }
  };

  // The company details exactly as they appear on the original bills.
  const COMPANY = {
    name: { en: 'Crapto Studio | Tech Solutions', ar: 'Crapto Studio | Tech Solutions' },
    owner: { en: 'Faisal Fahad Albusaidi', ar: 'فيصل فهد البوسعيدي' },
    phone: '+96894442029',
    email: '',
    accountName: { en: 'Faisal Fahad Albusaidi', ar: 'Faisal Fahad Albusaidi' },
    accountNo: '0348075139250013',
    bank: { en: 'Bank Muscat', ar: 'بنك مسقط' },
    currency: { en: 'OMR', ar: 'ر.ع' },
    currencyLong: { en: 'OMR', ar: 'ريال عماني' },
    logo: 'assets/logo.png',
    signature: 'assets/signature.png'
  };

  // Block catalogue. `make(lang)` returns a fresh block with sensible defaults.
  const BLOCKS = {
    heading: {
      name: 'Title',
      hint: 'Centered project or event title',
      make: (L) => ({ text: L.heading, align: 'center', size: 'lg' })
    },
    items: {
      name: 'Items table',
      hint: 'Services with quantity, price and automatic totals',
      make: (L) => ({
        showQty: true,
        head: { desc: L.desc, qty: L.qty, price: L.price, total: L.total },
        rows: [{ desc: '', details: '', qty: 1, price: 0 }],
        discount: 0,
        taxRate: 0,
        taxLabel: L.tax,
        deposit: 0,
        totalLabel: L.grandTotal,
        longCurrency: false,
        note: ''
      })
    },
    list: {
      name: 'Bullet list',
      hint: 'A heading with bullet points, e.g. scope or phases',
      make: (L) => ({ title: L.listTitle, items: '', tone: 'ink', boldLabel: false, width: 'half' })
    },
    note: {
      name: 'Text / note',
      hint: 'A paragraph, note, or thank-you line',
      make: () => ({ text: '', tone: 'plain', align: 'start', width: 'full' })
    },
    fields: {
      name: 'Custom fields',
      hint: 'Label and value pairs, e.g. PO number, due date',
      make: (L) => ({ title: L.fieldsTitle, rows: [{ label: '', value: '' }], width: 'half' })
    },
    payment: {
      name: 'Payment details',
      hint: 'Bank account and phone transfer from your company profile',
      make: (L) => ({ title: L.paymentTitle, showBank: true, showPhone: false, width: 'half' })
    },
    signature: {
      name: 'Signature',
      hint: 'Your signature, and a client signature line',
      make: (L) => ({ closing: L.regards, showOwn: true, showImage: true, showClient: false, clientLabel: L.clientSig, width: 'full' })
    },
    spacer: {
      name: 'Space',
      hint: 'Empty vertical space',
      make: () => ({ size: 24 })
    },
    divider: {
      name: 'Divider',
      hint: 'A thin horizontal line',
      make: () => ({})
    },
    pagebreak: {
      name: 'Page break',
      hint: 'Start a new page when printing',
      make: () => ({})
    }
  };

  // The two original bills, rebuilt as editable invoices.
  const SAMPLES = {
    gcoeat: {
      label: 'English — Global College (0114)',
      doc: {
        lang: 'en',
        digits: 'auto',
        pageSize: 'letter',
        decimals: 'auto',
        title: 'Invoice',
        number: '0114',
        date: '2025-11-20',
        clientLabel: 'Billed to',
        client: 'Global College of engineering and Technology',
        headerFields: [],
        showLogo: true,
        showFooter: true,
        blocks: [
          { type: 'heading', text: 'Omanis game developer’s booth', align: 'center', size: 'lg' },
          {
            type: 'items', showQty: true,
            head: { desc: 'Service', qty: 'Quantity', price: 'Price', total: 'Total' },
            rows: [{ desc: 'Showcasing video games projects by Omani game developers', details: '', qty: 4, price: 30 }],
            discount: 0, taxRate: 0, taxLabel: 'VAT', deposit: 0,
            totalLabel: 'Total invoice amount', longCurrency: false
          },
          { type: 'payment', title: 'Amount shall be transferred to our bank details', showBank: true, showPhone: false, width: 'half' },
          { type: 'signature', closing: 'Best Regards', showOwn: true, showImage: true, showClient: false, clientLabel: 'Client signature', width: 'half' }
        ]
      }
    },
    haifa: {
      label: 'Arabic — Haifa Alsiyabi',
      doc: {
        lang: 'ar',
        digits: 'arabic',
        pageSize: 'letter',
        decimals: 'auto',
        title: 'فاتورة عمل',
        number: '',
        date: '2025-09-19',
        clientLabel: 'العميل',
        client: 'هيفاء السيابي',
        headerFields: [],
        showLogo: true,
        showFooter: false,
        blocks: [
          { type: 'heading', text: 'تطوير لعبة محاكاة الصيدلاني', align: 'center', size: 'lg' },
          {
            type: 'items', showQty: false,
            head: { desc: 'العمل المنفذ', qty: 'الكمية', price: 'السعر', total: 'السعر' },
            rows: [
              { desc: 'تطوير الـ prototype المبدئي للعبة', details: '', qty: 1, price: 145 },
              { desc: 'التصاميم ثلاثية الأبعاد للعبة', details: '', qty: 1, price: 80 },
              { desc: 'تصاميم UI/UX للعبة', details: '', qty: 1, price: 45 },
              { desc: 'تثبيت اللعبة في الموقع', details: '', qty: 1, price: 25 }
            ],
            discount: 0, taxRate: 0, taxLabel: 'ضريبة القيمة المضافة', deposit: 0,
            totalLabel: 'المجموع', longCurrency: true,
            note: '*ملاحظة: الدفعة المقدمة 50% سيتم مباشرة العمل بعد أستلام المبلغ'
          },
          {
            type: 'list', title: 'تطوير الـ prototype المبدئي للعبة', tone: 'ink', boldLabel: false, width: 'half',
            items: 'برمجة المحاكاة للاعب\nتطوير البيئة التفاعلية\nدمج البيئة مع المحاكاة\nالتأكد من سلاسة اللعبة وقابلية اللعب'
          },
          {
            type: 'list', title: 'تثبيت اللعبة في الموقع', tone: 'ink', boldLabel: false, width: 'half',
            items: 'تثبيت اللعبة في مكان الفعالية\nتوفير الجهاز لتشغيل اللعبة\nتوفير الشاشة للعبة\nتوفير أجهزة التحكم للعبة'
          },
          {
            type: 'list', title: 'التصاميم ثلاثية الأبعاد', tone: 'ink', boldLabel: false, width: 'half',
            items: 'تصميم الشخصيات (الصيدلاني -ذكر و أنثى -، المرضى )\nتصاميم البيئة (الصيدلية)\nتصاميم الادوية وprops\nتصاميم الأنميشن'
          },
          {
            type: 'list', title: 'تصاميم UI/UX للعبة', tone: 'ink', boldLabel: false, width: 'half',
            items: 'تصميم واجهة المستخدم مناسبة للعبة\nتصاميم عصرية وديناميكية\nتفاعلية مع الاعب'
          },
          {
            type: 'list', title: 'مراحل تنفيذ العمل', tone: 'accent', boldLabel: true, width: 'half',
            items: 'المرحلة الاولى: تطوير النموذج الاولي القابل للتجربة\nالمرحلة الثانية: أختبار تجربة النموذج الاولي للمستخدم\nالمرحلة الثالثة: إكمال تطوير التطبيق بعد اللموافقة\nالمرحلة الرابعة: تصميم UI/UX ودمجة فالتطبيق\nالمرحلة الخامسة: الاختبار والاطلاق'
          },
          { type: 'payment', title: 'طرق الدفع', showBank: true, showPhone: true, width: 'half' },
          { type: 'note', text: 'شكرًا لكـــــم، دائمًا بخدمتكم.', tone: 'large', align: 'start', width: 'half' },
          { type: 'signature', closing: 'مع خالص التحية', showOwn: false, showImage: true, showClient: true, clientLabel: 'توقيع العميل', width: 'half' }
        ]
      }
    }
  };

  const PAGE_SIZES = {
    letter: { label: 'Letter (8.5 × 11 in)', w: '8.5in', h: '11in', px: [816, 1056] },
    a4: { label: 'A4 (210 × 297 mm)', w: '210mm', h: '297mm', px: [794, 1123] }
  };

  window.IM_DATA = { LABELS, COMPANY, BLOCKS, SAMPLES, PAGE_SIZES };
})();
