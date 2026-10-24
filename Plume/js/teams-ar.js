/* Team names in Arabic. ESPN gives every name in English, so Plume finds the Arabic in three ways:
     1. this list: the clubs of every competition Plume shows, written the way Saudi broadcasters write them;
     2. national teams: the country's Arabic name from the TV's own language data;
     3. anything else: the English name spelled in Arabic letters (a best effort, like the commentators' spelling). */
(function () {
  var CLUBS = {
    // Saudi Pro League and First Division
    'al hilal': 'الهلال', 'al nassr': 'النصر', 'al ittihad': 'الاتحاد', 'al ahli': 'الأهلي', 'al qadsiah': 'القادسية', 'al qadisiyah': 'القادسية',
    'al shabab': 'الشباب', 'al ettifaq': 'الاتفاق', 'al taawoun': 'التعاون', 'al taawon': 'التعاون', 'al fateh': 'الفتح', 'al fayha': 'الفيحاء',
    'al feiha': 'الفيحاء', 'al khaleej': 'الخليج', 'al riyadh': 'الرياض', 'al okhdood': 'الأخدود', 'al akhdoud': 'الأخدود', 'al kholood': 'الخلود',
    'damac': 'ضمك', 'al hazem': 'الحزم', 'al hazm': 'الحزم', 'al najma': 'النجمة', 'neom': 'نيوم', 'al wehda': 'الوحدة', 'al raed': 'الرائد',
    'al orobah': 'العروبة', 'al tai': 'الطائي', 'abha': 'أبها', 'al batin': 'الباطن', 'al faisaly': 'الفيصلي', 'al adalah': 'العدالة',
    'al jabalain': 'الجبلين', 'al bukiryah': 'البكيرية', 'al arabi': 'العربي', 'al ula': 'العُلا', 'al jandal': 'الجندل', 'al zulfi': 'الزلفي',
    'al anwar': 'الأنوار', 'jeddah': 'جدة', 'ohod': 'أحد', 'al diriyah': 'الدرعية', 'al safa': 'الصفا', 'al kawkab': 'الكوكب', 'hajer': 'هجر',
    'al nojoom': 'النجوم', 'al ain saudi': 'العين', 'al sahel': 'الساحل', 'al amjad': 'الأمجاد', 'al qaisumah': 'القيصومة', 'al draih': 'الدرع',
    'al washm': 'الوشم', 'al lewaa': 'اللواء', 'al taraji': 'الترجي',
    // Gulf, Asia
    'al sadd': 'السد', 'al duhail': 'الدحيل', 'al gharafa': 'الغرافة', 'al rayyan': 'الريان', 'al wakrah': 'الوكرة', 'al arabi sc': 'العربي',
    'qatar sc': 'قطر', 'al ahli doha': 'الأهلي', 'umm salal': 'أم صلال', 'al shamal': 'الشمال',
    'al ain': 'العين', 'al wahda': 'الوحدة', 'shabab al ahli': 'شباب الأهلي', 'shabab al ahli dubai': 'شباب الأهلي', 'sharjah': 'الشارقة',
    'al sharjah': 'الشارقة', 'al wasl': 'الوصل', 'al jazira': 'الجزيرة', 'al nasr dubai': 'النصر', 'baniyas': 'بني ياس', 'ajman': 'عجمان',
    'al kuwait': 'الكويت', 'kuwait sc': 'الكويت', 'al qadsia': 'القادسية', 'al arabi kuwait': 'العربي', 'al salmiya': 'السالمية', 'al khaldiya': 'الخالدية',
    'al muharraq': 'المحرق', 'al riffa': 'الرفاع', 'al khaldiya bahrain': 'الخالدية', 'al seeb': 'السيب', 'al nahda': 'النهضة', 'dhofar': 'ظفار',
    'al shorta': 'الشرطة', 'al zawraa': 'الزوراء', 'al quwa al jawiya': 'القوة الجوية', 'air force club': 'القوة الجوية', 'al talaba': 'الطلبة',
    'al hussein': 'الحسين', 'al wehdat': 'الوحدات', 'al faisaly jordan': 'الفيصلي', 'al ahed': 'العهد', 'al ansar': 'الأنصار',
    'persepolis': 'بيرسبوليس', 'esteghlal': 'استقلال طهران', 'tractor': 'تراكتور', 'tractor sazi': 'تراكتور', 'sepahan': 'سباهان',
    'foolad': 'فولاد', 'esteghlal khuzestan': 'استقلال خوزستان',
    'ulsan hd': 'أولسان', 'ulsan hyundai': 'أولسان', 'pohang steelers': 'بوهانغ ستيلرز', 'gwangju': 'غوانغجو', 'gwangju fc': 'غوانغجو',
    'jeonbuk hyundai motors': 'جيونبوك', 'jeonbuk motors': 'جيونبوك', 'gangwon': 'غانغوون', 'vissel kobe': 'فيسيل كوبي', 'yokohama f marinos': 'يوكوهاما مارينوس',
    'kawasaki frontale': 'كاواساكي فرونتالي', 'machida zelvia': 'ماتشيدا زيلفيا', 'sanfrecce hiroshima': 'سانفريتشي هيروشيما', 'urawa red diamonds': 'أوراوا ريد دايموندز',
    'shanghai port': 'شنغهاي بورت', 'shanghai shenhua': 'شنغهاي شينهوا', 'chengdu rongcheng': 'تشنغدو رونغتشنغ', 'shandong taishan': 'شاندونغ تايشان',
    'beijing guoan': 'بكين غوان', 'buriram united': 'بوريرام يونايتد', 'bangkok united': 'بانكوك يونايتد', 'port fc': 'بورت',
    'johor darul tazim': 'جوهور دار التعظيم', 'johor darul ta zim': 'جوهور دار التعظيم', 'melbourne city': 'ملبورن سيتي', 'central coast mariners': 'سنترال كوست مارينرز',
    'sydney fc': 'سيدني', 'sydney': 'سيدني', 'nasaf': 'نسف', 'nasaf qarshi': 'نسف', 'pakhtakor': 'باختاكور', 'navbahor': 'نافباخور',
    'ahal': 'آهال', 'arkadag': 'أركاداغ', 'mohun bagan': 'موهن باغان', 'mohun bagan super giant': 'موهن باغان', 'fc goa': 'غوا', 'goa': 'غوا',
    'lion city sailors': 'ليون سيتي سيلورز', 'tampines rovers': 'تامبينيس روفرز', 'persib': 'بيرسيب', 'persib bandung': 'بيرسيب', 'kaya': 'كايا',
    'nam dinh': 'نام دينه', 'eastern': 'إيسترن', 'kitchee': 'كيتشي', 'istiklol': 'استقلال دوشنبه', 'sepahan sc': 'سباهان',
    // Premier League
    'arsenal': 'أرسنال', 'aston villa': 'أستون فيلا', 'afc bournemouth': 'بورنموث', 'bournemouth': 'بورنموث', 'brentford': 'برنتفورد',
    'brighton & hove albion': 'برايتون', 'brighton and hove albion': 'برايتون', 'brighton': 'برايتون', 'burnley': 'بيرنلي', 'chelsea': 'تشيلسي',
    'crystal palace': 'كريستال بالاس', 'everton': 'إيفرتون', 'fulham': 'فولهام', 'leeds united': 'ليدز يونايتد', 'liverpool': 'ليفربول',
    'manchester city': 'مانشستر سيتي', 'manchester united': 'مانشستر يونايتد', 'newcastle united': 'نيوكاسل يونايتد', 'nottingham forest': 'نوتنغهام فورست',
    'sunderland': 'سندرلاند', 'tottenham hotspur': 'توتنهام هوتسبير', 'west ham united': 'وست هام يونايتد', 'wolverhampton wanderers': 'وولفرهامبتون',
    'leicester city': 'ليستر سيتي', 'ipswich town': 'إيبسويتش تاون', 'southampton': 'ساوثهامبتون',
    // La Liga
    'alaves': 'ديبورتيفو ألافيس', 'deportivo alaves': 'ديبورتيفو ألافيس', 'athletic club': 'أتلتيك بلباو', 'athletic bilbao': 'أتلتيك بلباو',
    'atletico madrid': 'أتلتيكو مدريد', 'barcelona': 'برشلونة', 'celta vigo': 'سيلتا فيغو', 'celta': 'سيلتا فيغو', 'elche': 'إلتشي', 'espanyol': 'إسبانيول',
    'getafe': 'خيتافي', 'girona': 'جيرونا', 'levante': 'ليفانتي', 'mallorca': 'مايوركا', 'osasuna': 'أوساسونا', 'rayo vallecano': 'رايو فاييكانو',
    'real betis': 'ريال بيتيس', 'real madrid': 'ريال مدريد', 'real oviedo': 'ريال أوفييدو', 'real sociedad': 'ريال سوسيداد', 'sevilla': 'إشبيلية',
    'valencia': 'فالنسيا', 'villarreal': 'فياريال', 'las palmas': 'لاس بالماس', 'leganes': 'ليغانيس', 'real valladolid': 'ريال بلد الوليد',
    // Champions League and big clubs
    'ajax': 'أياكس', 'ajax amsterdam': 'أياكس', 'atalanta': 'أتالانتا', 'bayer leverkusen': 'باير ليفركوزن', 'bayern munich': 'بايرن ميونخ',
    'benfica': 'بنفيكا', 'bodo glimt': 'بودو غليمت', 'bodo/glimt': 'بودو غليمت', 'bodø/glimt': 'بودو غليمت', 'bodø glimt': 'بودو غليمت', 'borussia dortmund': 'بوروسيا دورتموند', 'club brugge': 'كلوب بروج',
    'fc copenhagen': 'كوبنهاغن', 'copenhagen': 'كوبنهاغن', 'eintracht frankfurt': 'آينتراخت فرانكفورت', 'galatasaray': 'غلطة سراي',
    'internazionale': 'إنتر ميلان', 'inter milan': 'إنتر ميلان', 'juventus': 'يوفنتوس', 'kairat almaty': 'كايرات ألماتي', 'kairat': 'كايرات ألماتي',
    'marseille': 'مرسيليا', 'olympique marseille': 'مرسيليا', 'monaco': 'موناكو', 'as monaco': 'موناكو', 'napoli': 'نابولي', 'olympiacos': 'أولمبياكوس',
    'pafos': 'بافوس', 'paris saint germain': 'باريس سان جيرمان', 'psv eindhoven': 'آيندهوفن', 'psv': 'آيندهوفن', 'qarabag': 'قره باغ',
    'slavia prague': 'سلافيا براغ', 'sporting cp': 'سبورتنغ لشبونة', 'sporting lisbon': 'سبورتنغ لشبونة', 'union saint gilloise': 'يونيون سان جيلواز',
    'union st gilloise': 'يونيون سان جيلواز', 'ac milan': 'ميلان', 'milan': 'ميلان', 'rb leipzig': 'لايبزيغ', 'celtic': 'سلتيك', 'feyenoord': 'فينورد',
    'lille': 'ليل', 'brest': 'بريست', 'sturm graz': 'شتورم غراتس', 'red bull salzburg': 'سالزبورغ', 'salzburg': 'سالزبورغ', 'young boys': 'يونغ بويز',
    'shakhtar donetsk': 'شاختار دونيتسك', 'dinamo zagreb': 'دينامو زغرب', 'red star belgrade': 'النجم الأحمر', 'crvena zvezda': 'النجم الأحمر',
    'sparta prague': 'سبارتا براغ', 'slovan bratislava': 'سلوفان براتيسلافا', 'porto': 'بورتو', 'fc porto': 'بورتو', 'vfb stuttgart': 'شتوتغارت',
    'stuttgart': 'شتوتغارت', 'as roma': 'روما', 'roma': 'روما', 'lazio': 'لاتسيو', 'fenerbahce': 'فنربخشة', 'besiktas': 'بشكتاش', 'lyon': 'ليون',
    'borussia monchengladbach': 'بوروسيا مونشنغلادباخ', 'wolfsburg': 'فولفسبورغ', 'rangers': 'رينجرز', 'anderlecht': 'أندرلخت', 'braga': 'براغا',
    // Club World Cup
    'al ahly': 'الأهلي المصري', 'wydad': 'الوداد', 'wydad ac': 'الوداد', 'wydad casablanca': 'الوداد', 'esperance': 'الترجي',
    'esperance de tunis': 'الترجي', 'mamelodi sundowns': 'ماميلودي صنداونز', 'auckland city': 'أوكلاند سيتي', 'monterrey': 'مونتيري',
    'pachuca': 'باتشوكا', 'seattle sounders': 'سياتل ساوندرز', 'seattle sounders fc': 'سياتل ساوندرز', 'lafc': 'لوس أنجلوس', 'los angeles fc': 'لوس أنجلوس',
    'inter miami cf': 'إنتر ميامي', 'inter miami': 'إنتر ميامي', 'palmeiras': 'بالميراس', 'flamengo': 'فلامنغو', 'fluminense': 'فلومينينسي',
    'botafogo': 'بوتافوغو', 'river plate': 'ريفر بليت', 'boca juniors': 'بوكا جونيورز', 'zamalek': 'الزمالك', 'raja casablanca': 'الرجاء'
  };
  // national teams (also when the TV's language data has no Arabic)
  var NATIONS = {
    'saudi arabia': 'السعودية', 'kuwait': 'الكويت', 'qatar': 'قطر', 'united arab emirates': 'الإمارات', 'uae': 'الإمارات', 'bahrain': 'البحرين',
    'oman': 'عُمان', 'iraq': 'العراق', 'yemen': 'اليمن', 'jordan': 'الأردن', 'syria': 'سوريا', 'lebanon': 'لبنان', 'palestine': 'فلسطين',
    'egypt': 'مصر', 'morocco': 'المغرب', 'algeria': 'الجزائر', 'tunisia': 'تونس', 'libya': 'ليبيا', 'sudan': 'السودان', 'iran': 'إيران',
    'japan': 'اليابان', 'south korea': 'كوريا الجنوبية', 'korea republic': 'كوريا الجنوبية', 'north korea': 'كوريا الشمالية', 'china': 'الصين',
    'china pr': 'الصين', 'australia': 'أستراليا', 'uzbekistan': 'أوزبكستان', 'indonesia': 'إندونيسيا', 'thailand': 'تايلاند', 'vietnam': 'فيتنام',
    'malaysia': 'ماليزيا', 'india': 'الهند', 'kyrgyzstan': 'قيرغيزستان', 'tajikistan': 'طاجيكستان', 'turkmenistan': 'تركمانستان', 'hong kong': 'هونغ كونغ',
    'singapore': 'سنغافورة', 'philippines': 'الفلبين', 'pakistan': 'باكستان', 'bangladesh': 'بنغلاديش', 'afghanistan': 'أفغانستان', 'nepal': 'نيبال',
    'myanmar': 'ميانمار', 'cambodia': 'كمبوديا', 'laos': 'لاوس', 'mongolia': 'منغوليا', 'chinese taipei': 'تايوان', 'maldives': 'جزر المالديف',
    'sri lanka': 'سريلانكا', 'bhutan': 'بوتان', 'brunei': 'بروناي', 'macau': 'ماكاو', 'guam': 'غوام', 'timor leste': 'تيمور الشرقية',
    'england': 'إنجلترا', 'scotland': 'اسكتلندا', 'wales': 'ويلز', 'northern ireland': 'أيرلندا الشمالية', 'republic of ireland': 'أيرلندا',
    'ireland': 'أيرلندا', 'usa': 'الولايات المتحدة', 'united states': 'الولايات المتحدة', 'turkey': 'تركيا', 'turkiye': 'تركيا',
    'spain': 'إسبانيا', 'france': 'فرنسا', 'germany': 'ألمانيا', 'italy': 'إيطاليا', 'portugal': 'البرتغال', 'netherlands': 'هولندا',
    'belgium': 'بلجيكا', 'croatia': 'كرواتيا', 'brazil': 'البرازيل', 'argentina': 'الأرجنتين', 'mexico': 'المكسيك', 'canada': 'كندا',
    'senegal': 'السنغال', 'nigeria': 'نيجيريا', 'ghana': 'غانا', 'cameroon': 'الكاميرون', 'ivory coast': 'ساحل العاج', "cote d'ivoire": 'ساحل العاج',
    'mauritania': 'موريتانيا', 'comoros': 'جزر القمر', 'djibouti': 'جيبوتي', 'somalia': 'الصومال'
  };

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[-.’']/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/^(fc|sc|cf|afc) (?=\w)/, '').replace(/( (fc|sc|cf|club|saudi club|saudi))+$/, '').trim();
  }

  // the TV's own Arabic country names, found from the English ones
  var regions = null;
  function region(n) {
    if (regions === null) {
      regions = {};
      try {
        var en = new Intl.DisplayNames(['en'], { type: 'region' }), ar = new Intl.DisplayNames(['ar'], { type: 'region' });
        for (var i = 65; i <= 90; i++) for (var j = 65; j <= 90; j++) {
          var code = String.fromCharCode(i, j), e = en.of(code), a = ar.of(code);
          if (e && a && e !== code && a !== code && /[؀-ۿ]/.test(a)) regions[norm(e)] = a;
        }
      } catch (e) {}
    }
    return regions[n] || null;
  }

  /* spelling an English name in Arabic letters, the way Arabic commentary writes foreign names */
  var WORDS = { united: 'يونايتد', city: 'سيتي', real: 'ريال', sporting: 'سبورتنغ', athletic: 'أتلتيك', atletico: 'أتلتيكو', saint: 'سان', st: 'سانت',
    de: 'دي', del: 'ديل', la: 'لا', le: 'لو', town: 'تاون', rovers: 'روفرز', wanderers: 'واندررز', county: 'كاونتي', inter: 'إنتر', club: '', fc: '', sc: '',
    deportivo: 'ديبورتيفو', olympique: 'أولمبيك', dynamo: 'دينامو', dinamo: 'دينامو', racing: 'راسينغ', young: 'يونغ', boys: 'بويز', stars: 'ستارز', star: 'ستار' };
  var PAIRS = [['ei', 'اي'], ['ie', 'ي'], ['ea', 'ي'], ['sh', 'ش'], ['ch', 'تش'], ['kh', 'خ'], ['gh', 'غ'], ['th', 'ث'], ['ph', 'ف'], ['dh', 'ذ'], ['ou', 'و'], ['oo', 'و'], ['ee', 'ي'],
    ['ck', 'ك'], ['qu', 'كو'], ['ll', 'ل'], ['ss', 'س'], ['tt', 'ت'], ['ff', 'ف'], ['rr', 'ر'], ['nn', 'ن'], ['mm', 'م'], ['pp', 'ب'], ['bb', 'ب'], ['dd', 'د']];
  var ONE = { b: 'ب', c: 'ك', d: 'د', f: 'ف', g: 'غ', h: 'ه', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', p: 'ب', q: 'ق', r: 'ر', s: 'س', t: 'ت',
    v: 'ف', w: 'و', x: 'كس', y: 'ي', z: 'ز', i: 'ي', o: 'و', u: 'و' };
  /* Arabic names written in English letters (after "Al"): short vowels aren't written in Arabic: Jubail → جبيل */
  function spellArabic(w) {
    var out = '', i = 0;
    while (i < w.length) {
      var two = w.substr(i, 2), ch = w.charAt(i), first = i === 0, last = i === w.length - 1;
      if (/^(aa)$/.test(two)) { out += 'ا'; i += 2; continue; }
      if (/^(ee|ii|ai|ay|ei|ey)$/.test(two)) { out += 'ي'; i += 2; continue; }
      if (/^(oo|uu|ou|aw|au|ow)$/.test(two)) { out += 'و'; i += 2; continue; }
      if (/^(sh|kh|gh|th|dh)$/.test(two)) { out += { sh: 'ش', kh: 'خ', gh: 'غ', th: 'ث', dh: 'ذ' }[two]; i += 2; continue; }
      if (two.charAt(0) === two.charAt(1) && /[bcdfgjklmnpqrstvwxyz]/.test(ch)) { i++; continue; }   // a doubled letter is one letter
      if (ch === 'a') { out += first ? 'أ' : last ? 'ا' : (/[bcdfgjklmnpqrstvwxz]/.test(w.charAt(i + 1)) && w.charAt(i + 1) === w.charAt(i + 2)) ? '' : 'ا'; i++; continue; }
      if (ch === 'u' || ch === 'o') { out += first ? 'أ' : last ? 'و' : ''; i++; continue; }
      if (ch === 'i' || ch === 'e') { out += first ? 'إ' : last ? 'ي' : ''; i++; continue; }
      if (ch === 'h' && last && /a$/.test(w.slice(0, -1))) { out = out.replace(/ا$/, '') + 'ة'; i++; continue; }
      out += ({ b: 'ب', d: 'د', f: 'ف', g: 'ج', h: 'ه', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', q: 'ق', r: 'ر', s: 'س', t: 'ت', w: 'و', y: 'ي', z: 'ز', c: 'ك', p: 'ب', v: 'ف', x: 'كس' })[ch] || (/[0-9]/.test(ch) ? ch : '');
      i++;
    }
    return out;
  }
  var SKIP = { ac: 1, fk: 1, sk: 1, sv: 1, vfl: 1, bk: 1, if: 1, ik: 1, cd: 1, ud: 1, sd: 1, rc: 1, ss: 1, as: 1, us: 1, nk: 1, hnk: 1, ofk: 1, fc: 1, sc: 1, cf: 1 };
  function spellWord(w) {
    if (WORDS[w] != null) return WORDS[w];
    if (SKIP[w]) return '';
    var out = '', i = 0;
    while (i < w.length) {
      var two = w.substr(i, 2), pair = PAIRS.filter(function (p) { return p[0] === two; })[0];
      if (pair) { out += pair[1]; i += 2; continue; }
      var ch = w.charAt(i), first = i === 0, last = i === w.length - 1;
      if (ch === 'a') out += first ? 'أ' : 'ا';
      else if (ch === 'e') out += first ? 'إ' : last ? '' : (w.charAt(i + 1) === 'r' || w.charAt(i + 1) === 'l' ? '' : 'ي');
      else if (ch === 'i' && first) out += 'إي';
      else if ((ch === 'o' || ch === 'u') && first) out += 'أو';
      else if (ch === 'c' && /[eiy]/.test(w.charAt(i + 1))) out += 'س';
      else if (ch === 'g' && /[eiy]/.test(w.charAt(i + 1))) out += 'ج';
      else if (ch === 'h' && last) out += '';
      else if (/[0-9]/.test(ch)) out += ch;
      else out += ONE[ch] || '';
      i++;
    }
    return out.replace(/اه$/, 'ة');
  }
  function spell(n) {
    var words = n.split(' '), out = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if ((w === 'al' || w === 'el') && words[i + 1]) {
        var known = CLUBS['al ' + words[i + 1]];                  // "Al Shabab Al Arabi": الشباب العربي
        out.push(known || 'ال' + spellArabic(words[i + 1])); i++; continue;
      }   // "Al Jubail" → الجبيل
      var s = spellWord(w); if (s) out.push(s);
    }
    return out.join(' ');
  }

  var cache = {};
  P.teamAr = function (name, fallback) {
    if (/[؀-ۿ]/.test(name)) return name;              // already Arabic
    if (cache[name]) return cache[name];
    var n = norm(name);
    var hit = CLUBS[n] || NATIONS[n] || CLUBS[n.replace(/^al /, 'al ')] || region(n);
    if (!hit && / (u23|u20|u17|women)$/.test(n)) {                // "Saudi Arabia U23"
      var base = n.replace(/ (u23|u20|u17|women)$/, ''), tag = n.match(/ (u23|u20|u17|women)$/)[1];
      var b = CLUBS[base] || NATIONS[base] || region(base);
      if (b) hit = b + (tag === 'women' ? ' للسيدات' : ' تحت ' + tag.slice(1));
    }
    if (!hit) hit = spell(n) || fallback || name;
    cache[name] = hit;
    return hit;
  };
  P.teamAr._spell = spell; P.teamAr._norm = norm;   // for the tests
})();
