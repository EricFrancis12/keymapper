// TODO: convert to typescript

(function () {
    const MATCH_FIRST_MAPPING_ONLY = true;
    const TOAST_ON_MATCH = true;

    const TOGGLE_RUNNING_CHAR = "~";
    const TOGGLE_RUNNING_SHIFT_KEY = true;

    const KEY_MAPPINGS_JSON_FILE_PATH = "key_mappings.json";

    const smartRunner = {
        running: true,
        setRunning: async function (newRunning) {
            this.running = newRunning;

            chrome.storage.sync.set({
                running: JSON.stringify(newRunning),
            });
        },
        fetchSavedRunning: async function () {
            chrome.storage.sync.get(["running"], (obj) => {
                if (obj?.running === undefined) return;

                try {
                    const savedRunning = !!JSON.parse(obj.running);
                    this.setRunning(savedRunning);
                } catch (err) {
                    console.error(err);
                }
            });
        },
    };

    smartRunner.fetchSavedRunning();

    document.addEventListener("keyup", async (e) => {
        const { success, data } = await safeFetchJSONFile(KEY_MAPPINGS_JSON_FILE_PATH);
        if (!success) {
            return;
        }

        if ((!smartRunner.running && e.key === TOGGLE_RUNNING_CHAR && e.shiftKey === TOGGLE_RUNNING_SHIFT_KEY)
            || (smartRunner.running && e.key === "Escape")
        ) {
            const newRunning = !smartRunner.running;
            smartRunner.setRunning(newRunning);

            // TODO: fix toast switching from left to right side when right is called, and vice-versa
            butterup.toast({
                title: newRunning ? "Keymapper is Now Running ✅" : "Keymapper has been Stopped 🛑",
                message: newRunning ? "Press <b><u>ESC</u></b> to quit" : `Press <b><u>${TOGGLE_RUNNING_SHIFT_KEY ? "SHIFT</u></b> + <b><u>" : ""}${TOGGLE_RUNNING_CHAR}</u></b> to resume`,
                location: "top-left",
                dismissable: true,
            });

            return;
        }

        if (!smartRunner.running) return;

        for (const { url, key, action } of data.mappings) {
            const urlRegex = new RegExp(url);
            if (!urlRegex.test(window.location.href)) continue;

            if (!isMatchingKey(e, key)) continue;

            const { type, selector } = action;
            const element = document.querySelector(selector);

            const { success, toast } = await doElementAction(element, action);

            if (toast && TOAST_ON_MATCH) {
                butterup.toast({
                    title: `New action from key: "${key.char}"`,
                    message: `Executed <b>"${type}"</b> action on selector <b>"${selector}</b>"`,
                    location: "top-right",
                    dismissable: true,
                });
            }

            if (success && MATCH_FIRST_MAPPING_ONLY) break;
        }
    });

    async function safeFetchJSONFile(fileName) {
        try {
            const res = await fetch(chrome.runtime.getURL(fileName));
            const data = await res.json();
            return {
                success: true,
                data,
            };
        } catch (err) {
            console.error(err);
            return {
                success: false,
            };
        }
    }

    async function getCurrentTab() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "getCurrentTabId" }, (tab) => {
                if (tab?.id) {
                    resolve(tab);
                } else {
                    reject(null);
                }
            });
        });
    }

    async function removeCurrentTab() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: "removeTab" }, (resp) => {
                resolve(resp.success);
            });
        })
    }

    function copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text)
                    .then(() => {
                        resolve("Text copied to clipboard");
                    })
                    .catch(err => {
                        reject("Failed to copy: " + err);
                    });
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand("copy");
                    resolve("Text copied to clipboard");
                } catch (err) {
                    reject("Failed to copy: " + err);
                }
                document.body.removeChild(textarea);
            }
        });
    }

    function getClipboardText() {
        return new Promise((resolve, reject) => {
            navigator.clipboard.readText()
                .then(text => {
                    resolve(text);
                })
                .catch(err => {
                    reject("Failed to read clipboard contents: " + err);
                });
        });
    }

    function isMatchingKey(e, keyMapping) {
        if (e.shiftKey !== keyMapping.shiftKey) return false;
        return e.key.toLowerCase() === keyMapping.char.toLowerCase();
    }

    async function doElementAction(element, action) {
        switch (action.type) {
            case "click":
                if (element?.click) {
                    element.click();
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "focus":
                if (element?.focus) {
                    element.focus();
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "copy_text_content":
                if (element?.textContent != null) {
                    await copyToClipboard(element.textContent);
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "copy_value":
                if (element?.value != null) {
                    await copyToClipboard(element.value);
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "paste_value":
                if (element?.value != null) {
                    element.value = await getClipboardText();
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "custom_js":
                if (action.js) {
                    eval(action.js);
                    return {
                        success: true,
                        toast: true,
                    };
                } else {
                    return {
                        success: false,
                        toast: false,
                    };
                }
            case "back":
                window.history.back();
                return {
                    success: true,
                    toast: false,
                };
            case "forward":
                window.history.forward();
                return {
                    success: true,
                    toast: false,
                };
            case "refresh":
                location.reload();
                return {
                    success: true,
                    toast: false,
                };
            case "refresh_no_cache":
                location.reload(true);
                return {
                    success: true,
                    toast: false,
                };
            case "close_tab":
                await removeCurrentTab();
                return {
                    success: true,
                    toast: false,
                };
            default:
                return {
                    success: false,
                    toast: false,
                };
        }
    }

    // START Butterup (source: https://github.com/dgtlss/butterup)

    const butterup = {
        options: {
            maxToasts: 5, // Max number of toasts that can be on the screen at once
            toastLife: 5000, // How long a toast will stay on the screen before fading away
            currentToasts: 0, // Current number of toasts on the screen
        },
        toast: function ({
            title,
            message,
            type,
            location,
            icon,
            theme,
            customIcon,
            dismissable,
            onClick,
            onRender,
            onTimeout,
            customHTML,
            primaryButton,
            secondaryButton,
        }) {
            /* Check if the toaster exists. If it doesn't, create it. If it does, check if there are too many toasts on the screen.
            If there are too many, delete the oldest one and create a new one. If there aren't too many, create a new one. */
            let toaster;
            if (document.getElementById("toaster") == null) {
                // toaster doesn't exist, create it
                toaster = document.createElement("div");
                toaster.id = "toaster";
                if (location == null) {
                    toaster.className = "toaster top-right";
                } else {
                    toaster.className = "toaster " + location;
                }

                // Create the toasting rack inside of the toaster
                document.body.appendChild(toaster);

                // Create the toasting rack inside of the toaster
                if (document.getElementById("butterupRack") == null) {
                    const rack = document.createElement("ol");
                    rack.id = "butterupRack";
                    rack.className = "rack";
                    toaster.appendChild(rack);
                }
            } else {
                toaster = document.getElementById("toaster");
                // check what location the toaster is in
                toaster.classList.forEach(function (item) {
                    // remove any location classes from the toaster
                    if (item.includes("top-right")
                        || item.includes("top-center")
                        || item.includes("top-left")
                        || item.includes("bottom-right")
                        || item.includes("bottom-center")
                        || item.includes("bottom-left")
                    ) {
                        toaster.classList.remove(item);
                    }
                });
                if (location == null) {
                    toaster.className = "toaster top-right";
                } else {
                    toaster.className = "toaster " + location;
                }
            }

            // Check if there are too many toasts on the screen
            if (butterup.options.currentToasts >= butterup.options.maxToasts) {
                // there are too many toasts on the screen, delete the oldest one
                const oldestToast = document.getElementById("butterupRack").firstChild;
                document.getElementById("butterupRack").removeChild(oldestToast);
                butterup.options.currentToasts--;
            }

            // Create the toast
            const toast = document.createElement("li");
            butterup.options.currentToasts++;
            toast.className = "butteruptoast";
            // if the toast class contains a top or bottom location, add the appropriate class to the toast

            if (toaster.className.includes("top-right")
                || toaster.className.includes("top-center")
                || toaster.className.includes("top-left")
            ) {
                toast.className += " toastDown";
            }
            if (toaster.className.includes("bottom-right")
                || toaster.className.includes("bottom-center")
                || toaster.className.includes("bottom-left")
            ) {
                toast.className += " toastUp";
            }
            toast.id = "butterupToast-" + butterup.options.currentToasts;
            if (type != null) {
                toast.className += " " + type;
            }

            if (theme != null) {
                toast.className += " " + theme;
            }

            // Add the toast to the rack
            document.getElementById("butterupRack").appendChild(toast);

            // check if the user wants an icon
            if (icon != null && icon == true) {
                // add a div inside the toast with a class of icon
                const toastIcon = document.createElement("div");
                toastIcon.className = "icon";
                toast.appendChild(toastIcon);
                // check if the user has added a custom icon
                if (customIcon) {
                    toastIcon.innerHTML = customIcon;
                }
                if (type != null && customIcon == null) {
                    // add the type class to the toast
                    toast.className += " " + type;
                    if (type == "success") {
                        toastIcon.innerHTML =
                            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">` +
                            `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />` +
                            `</svg>`;
                    }
                    if (type == "error") {
                        toastIcon.innerHTML =
                            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">` +
                            `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />` +
                            `</svg>`;
                    }
                    if (type == "warning") {
                        toastIcon.innerHTML =
                            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">` +
                            `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />` +
                            `</svg>`;
                    }
                    if (type == "info") {
                        toastIcon.innerHTML =
                            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">` +
                            `<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />` +
                            `</svg>`;
                    }
                }
            }

            // add a div inside the toast with a class of notif
            const toastNotif = document.createElement("div");
            toastNotif.className = "notif";
            toast.appendChild(toastNotif);

            // add a div inside of notif with a class of desc
            const toastDesc = document.createElement("div");
            toastDesc.className = "desc";
            toastNotif.appendChild(toastDesc);

            // check if the user added a title
            if (title != null) {
                const toastTitle = document.createElement("div");
                toastTitle.className = "title";
                toastTitle.innerHTML = title;
                toastDesc.appendChild(toastTitle);
            }

            if (customHTML != null) {
                const toastHTML = document.createElement("div");
                toastHTML.className = "message";
                toastHTML.innerHTML = customHTML;
                toastDesc.appendChild(toastHTML);
            }

            // check if the user added a message
            if (message != null) {
                const toastMessage = document.createElement("div");
                toastMessage.className = "message";
                toastMessage.innerHTML = message;
                toastDesc.appendChild(toastMessage);
            }

            // Add buttons if specified
            if (primaryButton || secondaryButton) {
                const buttonContainer = document.createElement("div");
                buttonContainer.className = "toast-buttons";
                toastNotif.appendChild(buttonContainer);

                if (primaryButton) {
                    const primaryBtn = document.createElement("button");
                    primaryBtn.className = "toast-button primary";
                    primaryBtn.textContent = primaryButton.text;
                    primaryBtn.onclick = function (event) {
                        event.stopPropagation();
                        primaryButton.onClick(event);
                    };
                    buttonContainer.appendChild(primaryBtn);
                }

                if (secondaryButton) {
                    const secondaryBtn = document.createElement("button");
                    secondaryBtn.className = "toast-button secondary";
                    secondaryBtn.textContent = secondaryButton.text;
                    secondaryBtn.onclick = function (event) {
                        event.stopPropagation();
                        secondaryButton.onClick(event);
                    };
                    buttonContainer.appendChild(secondaryBtn);
                }
            }

            // Check if the user has mapped any custom click functions
            if (onClick && typeof onClick === "function") {
                toast.addEventListener("click", function (event) {
                    // Prevent the click event from triggering dismissal if the toast is dismissable
                    event.stopPropagation();
                    onClick(event);
                });
            }

            // Call onRender callback if provided
            if (onRender && typeof onRender === "function") {
                onRender(toast);
            }

            if (dismissable != null && dismissable == true) {
                // Add a class to the toast to make it dismissable
                toast.className += " dismissable";
                // when the item is clicked on, remove it from the DOM
                toast.addEventListener("click", function () {
                    butterup.despawnToast(toast.id);
                });
            }

            // remove the entrance animation class after the animation has finished
            setTimeout(function () {
                toast.className = toast.className.replace(" toastDown", "");
                toast.className = toast.className.replace(" toastUp", "");
            }, 500);

            // despawn the toast after the specified time
            setTimeout(function () {
                if (onTimeout && typeof onTimeout === "function") {
                    onTimeout(toast);
                }
                butterup.despawnToast(toast.id);
            }, butterup.options.toastLife);

        },
        despawnToast(toastId, onClosed) {
            // fade out the toast and then remove it from the DOM
            const toast = document.getElementById(toastId);
            // does the toast exist?
            if (toast != null) {
                toast.className += " fadeOutToast";
                setTimeout(function () {
                    // set the opacity to 0
                    try {
                        toast.style.opacity = "0";
                        toast.parentNode.removeChild(toast);
                        butterup.options.currentToasts--;
                        // Call onClosed callback if provided
                        if (onClosed && typeof onClosed === "function") {
                            onClosed(toast);
                        }
                    } catch (e) {
                        // do nothing
                    }
                    // if this was the last toast on the screen, remove the toaster
                    if (butterup.options.currentToasts == 0) {
                        const toaster = document.getElementById("toaster");
                        toaster.parentNode.removeChild(toaster);
                    }
                }, 500);
            }
        }
    };

    // END Butterup
})();
