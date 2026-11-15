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


// ─── Groups, Seasons, Timeline, Mysteries, Search, Profile ───────────
Object.assign(en, {
  'nav.story': 'Story Archive', 'nav.chapters': 'Chapters', 'nav.seasons': 'Seasons', 'nav.groups': 'Groups & Factions',
  'nav.timeline': 'Timeline', 'nav.mysteries': 'Mysteries', 'nav.search': 'Search', 'nav.profile': 'Profile',
  'common.optional': 'optional', 'home.readStory': 'Read the story',
  'characters.anyGroup': 'Any group', 'characters.noGroup': 'No group', 'characters.groups': 'Groups & factions',
  'characters.appearances': 'Appearances',

  'groups.title': 'Groups & Factions', 'groups.lead': 'The organisations, alliances and factions that shaped the Island.',
  'groups.empty': 'No groups yet.', 'groups.name': 'Group name', 'groups.status': 'Group status', 'groups.statusPh': 'e.g. Active, Disbanded',
  'groups.st.active': 'Active', 'groups.st.disbanded': 'Disbanded', 'groups.st.destroyed': 'Destroyed', 'groups.st.unknown': 'Unknown',
  'groups.logo': 'Logo or main image', 'groups.description': 'Description', 'groups.story': 'Full story', 'groups.history': 'Background & history',
  'groups.goals': 'Goals & objectives', 'groups.members': 'Members', 'groups.memberCount': '{n} members', 'groups.noMembers': 'No published members yet.',
  'groups.membersHelp': 'Add characters and choose their relationship. A character can appear more than once with different labels (e.g. Former Member and Enemy).',
  'groups.charHelp': 'A character can belong to several groups, each with its own relationship label.',
  'groups.relationship': 'Relationship', 'groups.addMember': 'Add character', 'groups.addToGroup': 'Add to a group',
  'groups.relatedSeasons': 'Related seasons', 'groups.relatedEvents': 'Related events', 'groups.images': 'Additional images',
  'groups.seasonNotePh': 'Their role in this season', 'groups.needText': 'Write a description or story before publishing.', 'groups.unlabelled': 'Other',

  'seasons.title': 'Seasons Encyclopedia', 'seasons.lead': 'Every season of the story, chapter by chapter.', 'seasons.empty': 'No seasons yet.',
  'seasons.name': 'Season name', 'seasons.namePh': 'e.g. Zero Point', 'seasons.chapter': 'Chapter', 'seasons.season': 'Season',
  'seasons.chapterN': 'Chapter {n}', 'seasons.seasonN': 'Season {n}', 'seasons.chapterNumber': 'Chapter number', 'seasons.seasonNumber': 'Season number',
  'seasons.release': 'Release date', 'seasons.end': 'End date', 'seasons.cover': 'Cover image', 'seasons.summary': 'Season summary',
  'seasons.story': 'Full season story', 'seasons.discoveries': 'Important discoveries', 'seasons.missions': 'Story missions',
  'seasons.characters': 'Important characters', 'seasons.groups': 'Groups involved', 'seasons.images': 'Images', 'seasons.references': 'References & sources',
  'seasons.timeline': 'Timeline', 'seasons.events': 'Events', 'seasons.eventN': 'Event {n}', 'seasons.contents': 'Contents',
  'seasons.otherSeasons': 'Other seasons', 'seasons.openChapter': 'Open chapter', 'seasons.fromArchive': 'From the image archive',
  'seasons.timelineHelp': 'Drag events or use ↑ ↓ to set the order. The order is saved immediately; events are never recreated.',
  'seasons.saveFirst': 'Save the season first, then add timeline events.', 'seasons.addEvent': 'Add event', 'seasons.noEvents': 'No events yet.',
  'seasons.orderSaved': 'Timeline order saved.', 'seasons.moveUp': 'Move up', 'seasons.moveDown': 'Move down',
  'seasons.eventName': 'Event name', 'seasons.eventDate': 'Date', 'seasons.eventImage': 'Event image', 'seasons.explanation': 'Full explanation',
  'seasons.relatedImages': 'Related images (from the image archive)', 'seasons.noEventBody': 'No explanation has been written yet.',
  'seasons.charNotePh': 'Their role in this season', 'seasons.groupNotePh': 'Their role in this season',
  'seasons.refTitle': 'Title', 'seasons.addRef': 'Add reference', 'seasons.noRefs': 'No references yet.',
  'seasons.badDates': 'The end date must be after the release date.', 'seasons.needText': 'Write a summary or story before publishing.',
  'chapters.title': 'Chapters', 'chapters.lead': 'The saga in its largest arcs.', 'chapters.seasonCount': '{n} seasons',
  'story.title': 'Story Archive', 'story.lead': 'Read the whole saga in order, season by season.', 'story.readFull': 'Read the full season',
  'timeline.title': 'Timeline', 'timeline.lead': 'Every recorded event across every season, in order.', 'timeline.empty': 'No events yet.',

  'mysteries.title': 'Mysteries', 'mysteries.lead': 'Unanswered questions, theories and the clues behind them.', 'mysteries.empty': 'No mysteries yet.',
  'mysteries.name': 'Mystery', 'mysteries.status': 'Status', 'mysteries.any': 'Any status', 'mysteries.body': 'The mystery',
  'mysteries.open': 'Unsolved', 'mysteries.partial': 'Partly answered', 'mysteries.solved': 'Solved',

  'search.title': 'Search the archive', 'search.placeholder': 'Characters, groups, seasons, events, images…', 'search.hint': 'Type at least 2 characters.',
  'search.none': 'Nothing matches “{q}”.',
  'profile.title': 'Your profile', 'profile.role': 'Access', 'profile.member': 'Member', 'profile.since': 'Member since', 'profile.changePassword': 'Change password',

  'dev.groups': 'Groups', 'dev.seasons': 'Seasons', 'dev.mysteries': 'Mysteries', 'dev.labels': 'Relationship labels',
  'dev.newGroup': 'New group', 'dev.newSeason': 'New season', 'dev.newMystery': 'New mystery',
  'dev.searchToAdd': 'Search to add…', 'dev.noMatches': 'No matches', 'dev.noneLinked': 'Nothing linked yet.', 'dev.notePh': 'Note (optional)',
  'dev.nothingYet': 'Nothing here yet.', 'dev.confirmDeleteGeneric': 'Delete “{name}”? This cannot be undone.',
  'labels.help': 'These labels describe how a character relates to a group. Add as many as the lore needs; both languages are shown on the site.',
  'labels.add': 'Add label', 'labels.inUse': 'This label is used by relationships. Change those first.',
  'images.season': 'Related season',
});
Object.assign(ar, {
  'nav.story': 'أرشيف القصة', 'nav.chapters': 'الفصول', 'nav.seasons': 'المواسم', 'nav.groups': 'المجموعات والفصائل',
  'nav.timeline': 'الخط الزمني', 'nav.mysteries': 'الألغاز', 'nav.search': 'بحث', 'nav.profile': 'الملف الشخصي',
  'common.optional': 'اختياري', 'home.readStory': 'اقرأ القصة',
  'characters.anyGroup': 'كل المجموعات', 'characters.noGroup': 'بلا مجموعة', 'characters.groups': 'المجموعات والفصائل',
  'characters.appearances': 'الظهور',

  'groups.title': 'المجموعات والفصائل', 'groups.lead': 'المنظمات والتحالفات والفصائل التي شكّلت الجزيرة.',
  'groups.empty': 'لا توجد مجموعات بعد.', 'groups.name': 'اسم المجموعة', 'groups.status': 'حالة المجموعة', 'groups.statusPh': 'مثال: نشطة، منحلّة',
  'groups.st.active': 'نشطة', 'groups.st.disbanded': 'منحلّة', 'groups.st.destroyed': 'مدمّرة', 'groups.st.unknown': 'مجهولة',
  'groups.logo': 'الشعار أو الصورة الرئيسية', 'groups.description': 'الوصف', 'groups.story': 'القصة الكاملة', 'groups.history': 'الخلفية والتاريخ',
  'groups.goals': 'الأهداف والغايات', 'groups.members': 'الأعضاء', 'groups.memberCount': '{n} عضو', 'groups.noMembers': 'لا يوجد أعضاء منشورون بعد.',
  'groups.membersHelp': 'أضف الشخصيات واختر علاقتها. يمكن أن تظهر الشخصية أكثر من مرة بعلاقات مختلفة (مثل عضو سابق وعدو).',
  'groups.charHelp': 'يمكن للشخصية أن تنتمي لعدة مجموعات، ولكل منها نوع علاقة خاص.',
  'groups.relationship': 'العلاقة', 'groups.addMember': 'إضافة شخصية', 'groups.addToGroup': 'إضافة إلى مجموعة',
  'groups.relatedSeasons': 'المواسم المرتبطة', 'groups.relatedEvents': 'الأحداث المرتبطة', 'groups.images': 'صور إضافية',
  'groups.seasonNotePh': 'دورها في هذا الموسم', 'groups.needText': 'اكتب وصفًا أو قصة قبل النشر.', 'groups.unlabelled': 'أخرى',

  'seasons.title': 'موسوعة المواسم', 'seasons.lead': 'كل مواسم القصة، فصلًا بعد فصل.', 'seasons.empty': 'لا توجد مواسم بعد.',
  'seasons.name': 'اسم الموسم', 'seasons.namePh': 'مثال: النقطة الصفرية', 'seasons.chapter': 'الفصل', 'seasons.season': 'الموسم',
  'seasons.chapterN': 'الفصل {n}', 'seasons.seasonN': 'الموسم {n}', 'seasons.chapterNumber': 'رقم الفصل', 'seasons.seasonNumber': 'رقم الموسم',
  'seasons.release': 'تاريخ الإصدار', 'seasons.end': 'تاريخ الانتهاء', 'seasons.cover': 'صورة الغلاف', 'seasons.summary': 'ملخص الموسم',
  'seasons.story': 'القصة الكاملة للموسم', 'seasons.discoveries': 'اكتشافات مهمة', 'seasons.missions': 'مهام القصة',
  'seasons.characters': 'شخصيات مهمة', 'seasons.groups': 'المجموعات المشاركة', 'seasons.images': 'الصور', 'seasons.references': 'المراجع والمصادر',
  'seasons.timeline': 'الخط الزمني', 'seasons.events': 'الأحداث', 'seasons.eventN': 'الحدث {n}', 'seasons.contents': 'المحتويات',
  'seasons.otherSeasons': 'مواسم أخرى', 'seasons.openChapter': 'افتح الفصل', 'seasons.fromArchive': 'من أرشيف الصور',
  'seasons.timelineHelp': 'اسحب الأحداث أو استخدم ↑ ↓ لترتيبها. يُحفظ الترتيب فورًا دون إعادة إنشاء الأحداث.',
  'seasons.saveFirst': 'احفظ الموسم أولًا ثم أضف أحداث الخط الزمني.', 'seasons.addEvent': 'إضافة حدث', 'seasons.noEvents': 'لا توجد أحداث بعد.',
  'seasons.orderSaved': 'تم حفظ ترتيب الخط الزمني.', 'seasons.moveUp': 'تحريك لأعلى', 'seasons.moveDown': 'تحريك لأسفل',
  'seasons.eventName': 'اسم الحدث', 'seasons.eventDate': 'التاريخ', 'seasons.eventImage': 'صورة الحدث', 'seasons.explanation': 'الشرح الكامل',
  'seasons.relatedImages': 'صور مرتبطة (من أرشيف الصور)', 'seasons.noEventBody': 'لم يُكتب شرح بعد.',
  'seasons.charNotePh': 'دورها في هذا الموسم', 'seasons.groupNotePh': 'دورها في هذا الموسم',
  'seasons.refTitle': 'العنوان', 'seasons.addRef': 'إضافة مرجع', 'seasons.noRefs': 'لا توجد مراجع بعد.',
  'seasons.badDates': 'يجب أن يكون تاريخ الانتهاء بعد تاريخ الإصدار.', 'seasons.needText': 'اكتب ملخصًا أو قصة قبل النشر.',
  'chapters.title': 'الفصول', 'chapters.lead': 'الملحمة في أكبر أقسامها.', 'chapters.seasonCount': '{n} مواسم',
  'story.title': 'أرشيف القصة', 'story.lead': 'اقرأ الملحمة كاملة بالترتيب، موسمًا بعد موسم.', 'story.readFull': 'اقرأ الموسم كاملًا',
  'timeline.title': 'الخط الزمني', 'timeline.lead': 'كل حدث مسجّل في كل موسم، بالترتيب.', 'timeline.empty': 'لا توجد أحداث بعد.',

  'mysteries.title': 'الألغاز', 'mysteries.lead': 'أسئلة بلا إجابة، ونظريات، والأدلة وراءها.', 'mysteries.empty': 'لا توجد ألغاز بعد.',
  'mysteries.name': 'اللغز', 'mysteries.status': 'الحالة', 'mysteries.any': 'كل الحالات', 'mysteries.body': 'اللغز',
  'mysteries.open': 'لم يُحل', 'mysteries.partial': 'حُلّ جزئيًا', 'mysteries.solved': 'حُلّ',

  'search.title': 'ابحث في الأرشيف', 'search.placeholder': 'شخصيات، مجموعات، مواسم، أحداث، صور…', 'search.hint': 'اكتب حرفين على الأقل.',
  'search.none': 'لا نتائج لـ «{q}».',
  'profile.title': 'ملفك الشخصي', 'profile.role': 'الصلاحية', 'profile.member': 'عضو', 'profile.since': 'عضو منذ', 'profile.changePassword': 'تغيير كلمة المرور',

  'dev.groups': 'المجموعات', 'dev.seasons': 'المواسم', 'dev.mysteries': 'الألغاز', 'dev.labels': 'أنواع العلاقات',
  'dev.newGroup': 'مجموعة جديدة', 'dev.newSeason': 'موسم جديد', 'dev.newMystery': 'لغز جديد',
  'dev.searchToAdd': 'ابحث للإضافة…', 'dev.noMatches': 'لا نتائج', 'dev.noneLinked': 'لا يوجد ربط بعد.', 'dev.notePh': 'ملاحظة (اختياري)',
  'dev.nothingYet': 'لا يوجد شيء بعد.', 'dev.confirmDeleteGeneric': 'حذف «{name}»؟ لا يمكن التراجع.',
  'labels.help': 'تصف هذه الأنواع علاقة الشخصية بالمجموعة. أضف ما تحتاجه القصة؛ تظهر اللغتان على الموقع.',
  'labels.add': 'إضافة نوع', 'labels.inUse': 'هذا النوع مستخدم في علاقات. غيّرها أولًا.',
  'images.season': 'الموسم المرتبط',
});

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
