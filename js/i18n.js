// English (LTR) and Arabic (RTL) interface strings.
const en = {
  'brand.name': 'Fortnite Lore', 'brand.tagline': 'The Island Archive',
  'nav.home': 'Home', 'nav.characters': 'Characters', 'nav.teams': 'Teams', 'nav.images': 'Image Archive',
  'nav.dev': 'Developer', 'nav.signIn': 'Sign in', 'nav.signOut': 'Sign out', 'nav.language': 'Switch language',

  'common.cancel': 'Cancel', 'common.close': 'Close', 'common.confirm': 'Are you sure?', 'common.delete': 'Delete',
  'common.draft': 'Draft', 'common.published': 'Published', 'common.edit': 'Edit', 'common.insert': 'Insert',
  'common.open': 'Open', 'common.remove': 'Remove', 'common.save': 'Save', 'common.search': 'Search…',
  'common.updated': 'Updated', 'common.view': 'View', 'common.viewAll': 'View all',

  'status.alive': 'Alive', 'status.dead': 'Dead', 'status.unknown': 'Unknown',
  'role.developer': 'Developer', 'role.admin': 'Admin',

  'gate.title': 'Members enter the archive', 'gate.body': 'Sign in to read every character story, faction record and image from the Island’s history.',
  'home.title': 'Every legend of the Island', 'home.lead': 'Character histories, factions and the images that recorded each season — collected in one archive.',
  'home.browseCharacters': 'Browse characters', 'home.browseImages': 'Open the image archive',
  'home.featured': 'Recently published', 'home.latestImages': 'From the image archive',

  'characters.title': 'Character Archive', 'characters.name': 'Character name', 'characters.status': 'Status',
  'characters.team': 'Team / Faction', 'characters.noTeam': 'No team', 'characters.story': 'Character story',
  'characters.image': 'Character image', 'characters.gallery': 'Gallery', 'characters.related': 'In the image archive',
  'characters.anyStatus': 'Any status', 'characters.anyTeam': 'Any team', 'characters.empty': 'No characters yet.',
  'characters.noStory': 'This story has not been written yet.',

  'teams.title': 'Teams & Factions', 'teams.name': 'Team name', 'teams.description': 'Description',
  'teams.count': '{n} characters', 'teams.empty': 'No teams yet.', 'teams.members': 'Members',
  'teams.noMembers': 'No published characters in this team yet.', 'teams.noDescription': 'No description',
  'teams.manageMembers': 'Members', 'teams.membersOf': 'Members of {name}',
  'teams.membersHelp': 'Tick the characters that belong to this team. A character can be in one team; ticking moves them here.',

  'images.title': 'Image Archive', 'images.file': 'Image file', 'images.story': 'Image story',
  'images.chapter': 'Chapter', 'images.event': 'Event', 'images.character': 'Related character',
  'images.uploaded': 'Uploaded', 'images.anyChapter': 'All chapters', 'images.empty': 'No images yet.',
  'images.noStory': 'No story has been written for this image yet.', 'images.noCharacter': 'None',
  'images.chapterPh': 'e.g. Chapter 2, Season 2', 'images.eventPh': 'e.g. The Device',

  'auth.email': 'Email', 'auth.password': 'Password', 'auth.signInTitle': 'Sign in', 'auth.signUpTitle': 'Create an account',
  'auth.forgotTitle': 'Reset your password', 'auth.createAccount': 'Create account', 'auth.sendLink': 'Send reset link',
  'auth.haveAccount': 'I already have an account', 'auth.needAccount': 'Create a new account', 'auth.forgot': 'Forgot password?',
  'auth.badEmail': 'Enter a valid email address.', 'auth.shortPassword': 'Use at least 8 characters.',
  'auth.invalid': 'Wrong email or password.', 'auth.welcome': 'Welcome to the archive.', 'auth.signedOut': 'Signed out.',
  'auth.checkEmail': 'Check your email', 'auth.checkEmailBody': 'We sent you a confirmation link. Open it on this device to finish signing up.',
  'auth.resetSent': 'If that address has an account, a reset link is on its way.', 'auth.newPassword': 'Choose a new password',
  'auth.passwordUpdated': 'Password updated.',

  'dev.eyebrow': 'Developer dashboard', 'dev.title': 'Archive management', 'dev.overview': 'Overview',
  'dev.characters': 'Characters', 'dev.teams': 'Teams', 'dev.images': 'Image Archive', 'dev.access': 'Access',
  'dev.publishedOf': '{n} published', 'dev.newCharacter': 'New character', 'dev.newImage': 'New image', 'dev.newTeam': 'New team',
  'dev.editTeam': 'Edit team', 'dev.roleNote': 'Signed in with role: {roles}. Permissions are enforced by the database.',
  'dev.visibility': 'Visibility', 'dev.allStates': 'Drafts and published', 'dev.basics': 'Basics', 'dev.details': 'Details',
  'dev.charImages': 'Character images', 'dev.charImagesHelp': 'Each image has its own name and story. The cover image appears at the top of the profile.',
  'dev.addImage': 'Add images', 'dev.noImages': 'No images yet.', 'dev.cover': 'Cover', 'dev.replace': 'Replace image',
  'dev.chooseFile': 'Choose image', 'dev.dropHint': 'Drop an image here or choose a file (JPG, PNG, WebP, GIF, AVIF · up to 15 MB)',
  'dev.imageName': 'Image name', 'dev.imageStory': 'Image story', 'dev.imageStoryPlaceholder': 'The story behind this image…',
  'dev.storyPlaceholder': 'Write the full story. Use headings, lists, links and images — there is no length limit.',
  'dev.preview': 'Preview', 'dev.saveDraft': 'Save draft', 'dev.saveChanges': 'Save changes',
  'dev.publish': 'Publish', 'dev.unpublish': 'Unpublish', 'dev.saved': 'Saved.', 'dev.deleted': 'Deleted.',
  'dev.publishedOk': 'Published — now visible to members.', 'dev.unpublished': 'Unpublished — back to draft.',
  'dev.nameRequired': 'A name is required.', 'dev.previewBanner': 'Preview — not published yet', 'dev.draftBanner': 'Draft — only developers can see this',
  'dev.confirmDeleteChar': 'Delete “{name}” and all of its images? This cannot be undone.',
  'dev.confirmDeleteImage': 'Delete “{name}” from the image archive? This cannot be undone.',
  'dev.confirmDeleteTeam': 'Delete the team “{name}”? Its characters will be left without a team.',

  'access.help': 'Give developer access to people who already have an account. Only admins can change access; the database rejects anyone else.',
  'access.role': 'Role', 'access.grant': 'Grant access', 'access.revoke': 'Revoke', 'access.confirmRevoke': 'Remove this role?',

  'editor.toolbar': 'Formatting', 'editor.h2': 'Heading', 'editor.h3': 'Subheading', 'editor.paragraph': 'Paragraph',
  'editor.bold': 'Bold', 'editor.italic': 'Italic', 'editor.underline': 'Underline', 'editor.bullets': 'Bulleted list',
  'editor.numbers': 'Numbered list', 'editor.quote': 'Quote', 'editor.rule': 'Divider', 'editor.link': 'Insert link',
  'editor.unlink': 'Remove link', 'editor.image': 'Insert image', 'editor.rtl': 'Right-to-left paragraph',
  'editor.ltr': 'Left-to-right paragraph', 'editor.clear': 'Clear formatting', 'editor.undo': 'Undo', 'editor.redo': 'Redo',
  'editor.placeholder': 'Start writing…', 'editor.words': '{n} words', 'editor.uploading': 'Uploading image…',
  'editor.linkUrl': 'Link address', 'editor.badUrl': 'Links must start with https://', 'editor.caption': 'Caption',

  'media.noFile': 'Choose an image file.', 'media.badType': 'Use a JPG, PNG, WebP, GIF or AVIF image.', 'media.tooBig': 'Images must be 15 MB or smaller.',

  'error.title': 'Something went wrong', 'error.generic': 'Something went wrong.', 'error.notFound': 'Not found',
  'error.forbidden': 'You don’t have permission to do that.', 'error.network': 'Can’t reach the server. Check your connection.',
  'error.storyRequired': 'Write the story before publishing.', 'error.duplicate': 'That name is already used.',
  'error.devOnly': 'Developers only', 'error.devOnlyBody': 'This area is for verified archive developers.',
};

const ar = {
  'brand.name': 'أساطير فورتنايت', 'brand.tagline': 'أرشيف الجزيرة',
  'nav.home': 'الرئيسية', 'nav.characters': 'الشخصيات', 'nav.teams': 'الفرق', 'nav.images': 'أرشيف الصور',
  'nav.dev': 'المطوّرون', 'nav.signIn': 'تسجيل الدخول', 'nav.signOut': 'تسجيل الخروج', 'nav.language': 'تغيير اللغة',

  'common.cancel': 'إلغاء', 'common.close': 'إغلاق', 'common.confirm': 'هل أنت متأكد؟', 'common.delete': 'حذف',
  'common.draft': 'مسودة', 'common.published': 'منشور', 'common.edit': 'تعديل', 'common.insert': 'إدراج',
  'common.open': 'فتح', 'common.remove': 'إزالة', 'common.save': 'حفظ', 'common.search': 'بحث…',
  'common.updated': 'آخر تحديث', 'common.view': 'عرض', 'common.viewAll': 'عرض الكل',

  'status.alive': 'على قيد الحياة', 'status.dead': 'ميت', 'status.unknown': 'مجهول',
  'role.developer': 'مطوّر', 'role.admin': 'مدير',

  'gate.title': 'الأرشيف للأعضاء', 'gate.body': 'سجّل الدخول لقراءة قصص الشخصيات وسجلات الفرق وصور تاريخ الجزيرة.',
  'home.title': 'كل أساطير الجزيرة', 'home.lead': 'تواريخ الشخصيات والفرق والصور التي وثّقت كل موسم — مجموعة في أرشيف واحد.',
  'home.browseCharacters': 'تصفّح الشخصيات', 'home.browseImages': 'افتح أرشيف الصور',
  'home.featured': 'نُشرت حديثًا', 'home.latestImages': 'من أرشيف الصور',

  'characters.title': 'أرشيف الشخصيات', 'characters.name': 'اسم الشخصية', 'characters.status': 'الحالة',
  'characters.team': 'الفريق / الفصيل', 'characters.noTeam': 'بلا فريق', 'characters.story': 'قصة الشخصية',
  'characters.image': 'صورة الشخصية', 'characters.gallery': 'معرض الصور', 'characters.related': 'في أرشيف الصور',
  'characters.anyStatus': 'كل الحالات', 'characters.anyTeam': 'كل الفرق', 'characters.empty': 'لا توجد شخصيات بعد.',
  'characters.noStory': 'لم تُكتب هذه القصة بعد.',

  'teams.title': 'الفرق والفصائل', 'teams.name': 'اسم الفريق', 'teams.description': 'الوصف',
  'teams.count': '{n} شخصية', 'teams.empty': 'لا توجد فرق بعد.', 'teams.members': 'الأعضاء',
  'teams.noMembers': 'لا توجد شخصيات منشورة في هذا الفريق بعد.', 'teams.noDescription': 'بلا وصف',
  'teams.manageMembers': 'الأعضاء', 'teams.membersOf': 'أعضاء {name}',
  'teams.membersHelp': 'اختر الشخصيات التي تنتمي لهذا الفريق. للشخصية فريق واحد؛ اختيارها ينقلها إلى هنا.',

  'images.title': 'أرشيف الصور', 'images.file': 'ملف الصورة', 'images.story': 'قصة الصورة',
  'images.chapter': 'الفصل', 'images.event': 'الحدث', 'images.character': 'الشخصية المرتبطة',
  'images.uploaded': 'تاريخ الرفع', 'images.anyChapter': 'كل الفصول', 'images.empty': 'لا توجد صور بعد.',
  'images.noStory': 'لم تُكتب قصة لهذه الصورة بعد.', 'images.noCharacter': 'لا يوجد',
  'images.chapterPh': 'مثال: الفصل 2، الموسم 2', 'images.eventPh': 'مثال: الجهاز',

  'auth.email': 'البريد الإلكتروني', 'auth.password': 'كلمة المرور', 'auth.signInTitle': 'تسجيل الدخول', 'auth.signUpTitle': 'إنشاء حساب',
  'auth.forgotTitle': 'استعادة كلمة المرور', 'auth.createAccount': 'إنشاء الحساب', 'auth.sendLink': 'أرسل رابط الاستعادة',
  'auth.haveAccount': 'لدي حساب بالفعل', 'auth.needAccount': 'إنشاء حساب جديد', 'auth.forgot': 'نسيت كلمة المرور؟',
  'auth.badEmail': 'أدخل بريدًا إلكترونيًا صحيحًا.', 'auth.shortPassword': 'استخدم 8 أحرف على الأقل.',
  'auth.invalid': 'البريد أو كلمة المرور غير صحيحة.', 'auth.welcome': 'أهلًا بك في الأرشيف.', 'auth.signedOut': 'تم تسجيل الخروج.',
  'auth.checkEmail': 'تفقّد بريدك', 'auth.checkEmailBody': 'أرسلنا لك رابط تأكيد. افتحه على هذا الجهاز لإكمال التسجيل.',
  'auth.resetSent': 'إن كان لهذا البريد حساب فسيصلك رابط الاستعادة.', 'auth.newPassword': 'اختر كلمة مرور جديدة',
  'auth.passwordUpdated': 'تم تحديث كلمة المرور.',

  'dev.eyebrow': 'لوحة المطوّرين', 'dev.title': 'إدارة الأرشيف', 'dev.overview': 'نظرة عامة',
  'dev.characters': 'الشخصيات', 'dev.teams': 'الفرق', 'dev.images': 'أرشيف الصور', 'dev.access': 'الصلاحيات',
  'dev.publishedOf': '{n} منشور', 'dev.newCharacter': 'شخصية جديدة', 'dev.newImage': 'صورة جديدة', 'dev.newTeam': 'فريق جديد',
  'dev.editTeam': 'تعديل الفريق', 'dev.roleNote': 'دورك: {roles}. قاعدة البيانات هي من تتحقق من الصلاحيات.',
  'dev.visibility': 'الحالة', 'dev.allStates': 'المسودات والمنشور', 'dev.basics': 'الأساسيات', 'dev.details': 'التفاصيل',
  'dev.charImages': 'صور الشخصية', 'dev.charImagesHelp': 'لكل صورة اسم وقصة خاصة بها. صورة الغلاف تظهر أعلى الملف الشخصي.',
  'dev.addImage': 'إضافة صور', 'dev.noImages': 'لا توجد صور بعد.', 'dev.cover': 'الغلاف', 'dev.replace': 'استبدال الصورة',
  'dev.chooseFile': 'اختر صورة', 'dev.dropHint': 'اسحب صورة إلى هنا أو اختر ملفًا (JPG، PNG، WebP، GIF، AVIF · حتى 15 ميغابايت)',
  'dev.imageName': 'اسم الصورة', 'dev.imageStory': 'قصة الصورة', 'dev.imageStoryPlaceholder': 'القصة وراء هذه الصورة…',
  'dev.storyPlaceholder': 'اكتب القصة كاملة. استخدم العناوين والقوائم والروابط والصور — لا يوجد حد للطول.',
  'dev.preview': 'معاينة', 'dev.saveDraft': 'حفظ كمسودة', 'dev.saveChanges': 'حفظ التغييرات',
  'dev.publish': 'نشر', 'dev.unpublish': 'إلغاء النشر', 'dev.saved': 'تم الحفظ.', 'dev.deleted': 'تم الحذف.',
  'dev.publishedOk': 'تم النشر — أصبح ظاهرًا للأعضاء.', 'dev.unpublished': 'أُلغي النشر — عاد مسودة.',
  'dev.nameRequired': 'الاسم مطلوب.', 'dev.previewBanner': 'معاينة — لم يُنشر بعد', 'dev.draftBanner': 'مسودة — يراها المطوّرون فقط',
  'dev.confirmDeleteChar': 'حذف «{name}» وكل صورها؟ لا يمكن التراجع.',
  'dev.confirmDeleteImage': 'حذف «{name}» من أرشيف الصور؟ لا يمكن التراجع.',
  'dev.confirmDeleteTeam': 'حذف فريق «{name}»؟ ستبقى شخصياته بلا فريق.',

  'access.help': 'امنح صلاحية المطوّر لأشخاص لديهم حساب بالفعل. المدراء فقط يمكنهم تغيير الصلاحيات؛ وقاعدة البيانات ترفض غيرهم.',
  'access.role': 'الدور', 'access.grant': 'منح الصلاحية', 'access.revoke': 'سحب', 'access.confirmRevoke': 'إزالة هذا الدور؟',

  'editor.toolbar': 'التنسيق', 'editor.h2': 'عنوان', 'editor.h3': 'عنوان فرعي', 'editor.paragraph': 'فقرة',
  'editor.bold': 'غامق', 'editor.italic': 'مائل', 'editor.underline': 'تسطير', 'editor.bullets': 'قائمة نقطية',
  'editor.numbers': 'قائمة مرقّمة', 'editor.quote': 'اقتباس', 'editor.rule': 'فاصل', 'editor.link': 'إدراج رابط',
  'editor.unlink': 'إزالة الرابط', 'editor.image': 'إدراج صورة', 'editor.rtl': 'فقرة من اليمين لليسار',
  'editor.ltr': 'فقرة من اليسار لليمين', 'editor.clear': 'مسح التنسيق', 'editor.undo': 'تراجع', 'editor.redo': 'إعادة',
  'editor.placeholder': 'ابدأ الكتابة…', 'editor.words': '{n} كلمة', 'editor.uploading': 'جارٍ رفع الصورة…',
  'editor.linkUrl': 'عنوان الرابط', 'editor.badUrl': 'يجب أن يبدأ الرابط بـ https://', 'editor.caption': 'تعليق',

  'media.noFile': 'اختر ملف صورة.', 'media.badType': 'استخدم صورة JPG أو PNG أو WebP أو GIF أو AVIF.', 'media.tooBig': 'يجب ألا يتجاوز حجم الصورة 15 ميغابايت.',

  'error.title': 'حدث خطأ', 'error.generic': 'حدث خطأ.', 'error.notFound': 'غير موجود',
  'error.forbidden': 'ليست لديك صلاحية لذلك.', 'error.network': 'تعذّر الوصول للخادم. تحقق من اتصالك.',
  'error.storyRequired': 'اكتب القصة قبل النشر.', 'error.duplicate': 'هذا الاسم مستخدم بالفعل.',
  'error.devOnly': 'للمطوّرين فقط', 'error.devOnlyBody': 'هذا القسم مخصص لمطوّري الأرشيف الموثّقين.',
};

const dicts = { en, ar };
let lang = 'en';
try {
  const saved = localStorage.getItem('lore:lang');
  lang = dicts[saved] ? saved : ((navigator.language || '').startsWith('ar') ? 'ar' : 'en');
} catch { /* ignore */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = dicts[l] ? l : 'en';
  try { localStorage.setItem('lore:lang', lang); } catch { /* ignore */ }
  applyLang();
}
export function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = dicts[lang]['brand.name'];
  const brand = document.querySelector('[data-brand]');
  if (brand) brand.textContent = dicts[lang]['brand.name'];
}
export function t(key, vars) {
  let s = dicts[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
