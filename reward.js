/**
 * auto-reward.js — Final Version (UTM-only)
 *
 * FLOW:
 *   UTM (utm_campign=allcountry) -> UTM URL strip -> hit-count check -> reward sirf eligible hit pe
 *   Direct domain                -> kuch nahi dikhana (no popup, no dialog, no ad) — silent no-op
 */

(function () {
  'use strict';

  var rewardEnabled = true;
  if (!rewardEnabled) return;

  var UTM_KEY = 'utm_campign';
  var UTM_VAL = 'allcountry';

  // -- UTM reward pattern config -----------------------------------
  // Reward milega hit #1 pe, fir har +1 ke gap pe (config se control hota hai)
  var UTM_FIRST_REWARD_HIT = 1;
  var UTM_REWARD_STEP      = 1;
  var UTM_HIT_COUNT_KEY    = 'utmRewardHitCount';

  // -- Hardcoded reward ad unit -------------------------------------
  var REWARD_AD_UNIT = '/23353868385/champslevl.com_reward';

  // -- Debug helper ----------------------------------------------
  function dbg(msg, data, color) {
    if (window._dbg) window._dbg('[auto-reward] ' + msg, data, color);
    else console.log('[auto-reward]', msg, data !== undefined ? data : '');
  }

  // -- UTM check + URL clean karo --------------------------------
  function getSessionType() {
    try {
      var url    = new URL(window.location.href);
      var params = url.searchParams;
      var utmVal = params.get(UTM_KEY);
      var isActive = (utmVal === UTM_VAL);

      if (isActive) {
        // UTM params URL se hata do (clean URL, back button me nahi aayega)
        var utmKeys = [
          'utm_campign', 'utm_source', 'utm_medium',
          'utm_campaign', 'utm_term', 'utm_content', 'utm_id'
        ];
        utmKeys.forEach(function(k) { params.delete(k); });
        var cleanUrl = url.pathname + (params.toString() ? '?' + params.toString() : '') + url.hash;
        history.replaceState(null, document.title, cleanUrl);
        dbg('UTM stripped from URL -> ACTIVE user', utmVal, '#88ff88');
        return 'active';
      }

      dbg('No UTM -> INACTIVE user (no-op)', null, '#ffaa00');
      return 'inactive';

    } catch (e) {
      dbg('URL parse error -> inactive fallback', e.message, '#ff4444');
      return 'inactive';
    }
  }

  // -- UTM user ka hit counter (per browser/device, localStorage) --
  // Har visit pe +1, return karta hai ki ye hit reward-eligible hai ya nahi.
  function bumpUtmHitCountAndCheckReward() {
    var count;
    try {
      count = parseInt(localStorage.getItem(UTM_HIT_COUNT_KEY), 10);
      if (isNaN(count) || count < 0) count = 0;
    } catch (e) {
      count = 0;
    }

    count += 1;

    try {
      localStorage.setItem(UTM_HIT_COUNT_KEY, String(count));
    } catch (e) {
      dbg('localStorage write failed for hit count', e.message, '#ff4444');
    }

    var isEligible;
    if (count < UTM_FIRST_REWARD_HIT) {
      isEligible = false;
    } else if (count === UTM_FIRST_REWARD_HIT) {
      isEligible = true;
    } else {
      isEligible = ((count - UTM_FIRST_REWARD_HIT) % UTM_REWARD_STEP === 0);
    }

    dbg('UTM hit #' + count + (isEligible ? ' -> REWARD ELIGIBLE' : ' -> skip (no reward this hit)'), null, isEligible ? '#88ff88' : '#888888');

    return isEligible;
  }

  // -- GPT Rewarded Slot -----------------------------------------
  // Note: popup UI removed from this flow since direct/non-UTM visitors
  // never reach this function anymore (see Main section below).
  function launchRewardedAd() {
    window.googletag = window.googletag || { cmd: [] };

    googletag.cmd.push(function () {
      if (!googletag.enums ||
          !googletag.enums.OutOfPageFormat ||
          !googletag.enums.OutOfPageFormat.REWARDED) {
        dbg('Reward format not supported', null, '#ff4444');
        return;
      }

      var rewardAdUnit = REWARD_AD_UNIT;

      dbg('Defining rewarded slot', rewardAdUnit, '#88ffff');

      var rewardedSlot = googletag.defineOutOfPageSlot(
        rewardAdUnit,
        googletag.enums.OutOfPageFormat.REWARDED
      );

      if (!rewardedSlot) {
        dbg('defineOutOfPageSlot returned null', null, '#ff4444');
        return;
      }

      rewardedSlot.addService(googletag.pubads());

      googletag.pubads().addEventListener('rewardedSlotReady', function (event) {
        dbg('rewardedSlotReady', null, '#88ff88');
        // UTM user, hit-count eligibility already checked -> seedha ad
        event.makeRewardedVisible();
      });

      googletag.pubads().addEventListener('rewardedSlotGranted', function () {
        dbg('Reward GRANTED', null, '#ffff00');
      });

      googletag.pubads().addEventListener('rewardedSlotClosed', function () {
        dbg('Slot closed', null, '#888888');
        googletag.destroySlots([rewardedSlot]);
      });

      googletag.enableServices();
      googletag.display(rewardedSlot);
    });
  }

  // -- Main -----------------------------------------------------
  var sessionType = getSessionType();

  if (sessionType === 'inactive') {
    // Direct domain user -> kuch nahi dikhana. Silent no-op, return immediately.
    dbg('Inactive -> no popup, no dialog, no ad. Exiting.', null, '#ffaa00');
    return;
  }

  // UTM user -> hit counter check karo, sirf eligible hit pe reward milega
  var eligible = bumpUtmHitCountAndCheckReward();
  if (!eligible) {
    dbg('Active (UTM) -> this hit not eligible for reward, skipping', null, '#888888');
    return;
  }
  dbg('Active (UTM) -> eligible hit, direct reward', null, '#88ff88');

  // Page load ke baad thoda wait karo - feels natural
  setTimeout(function () {
    launchRewardedAd();
  }, 800);

})();