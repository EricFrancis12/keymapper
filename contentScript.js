(function () {
    const MATCH_FIRST_MAPPING_ONLY = true;

    const MAPPINGS = {
        "mappings": [
            {
                "url": "developer.mo",
                "key": {
                    "char": "f",
                    "shiftKey": true,
                },
                "action": {
                    "type": "click",
                    "selector": "#try_it > a"
                }
            }
        ]
    };

    document.addEventListener("keypress", e => {
        for (const { url, key, action } of MAPPINGS.mappings) {
            const urlRegex = new RegExp(url);
            if (!urlRegex.test(window.location.href)) continue;

            if (!isMatchingKey(e, key)) continue;

            const { type, selector } = action;
            const element = document.querySelector(selector);
            if (element) {
                doElementAction(element, type);

                if (MATCH_FIRST_MAPPING_ONLY) break;
            }
        }
    });

    function isMatchingKey(e, keyMapping) {
        if (e.shiftKey !== keyMapping.shiftKey) return false;
        return e.key.toLowerCase() === keyMapping.char.toLowerCase();
    }

    function doElementAction(element, actionType) {
        switch (actionType) {
            case "click": element.click(); break;
        }
    }
})();
