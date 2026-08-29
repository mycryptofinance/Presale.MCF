const BASE_CHAIN_ID = "0x2105"; // Chain ID 8453 (Base)
        const PRESALE_ADDRESS = "0x580Cd51dEFE879C050bbD1c47Db1C4Cb2be6D861";
        const MCF_TOKEN_ADDRESS = "0x03B7301895Ef14430b6f0465e27680b0AC6C971B";
        const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        const USDT_ADDRESS = "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2";

        const RATES = {
            USDC: 8000,     
            USDT: 8000,     
            ETH: 20000000   
        };

        const ERC20_ABI = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ];

        const PRESALE_ABI = [
            "function buyWithETH() payable",
            "function buyWithUSDC(uint256 usdcAmount)",
            "function buyWithUSDT(uint256 usdtAmount)"
        ];

        let provider, signer, userAddress;
        let isConnected = false;

       let lastEdited = 'pay'; // Отслеживаем, какое поле вводил пользователь последние ('pay' или 'mcf')

    // Ввод в верхнем поле -> рассчитываем MCF
    function calculateMCF() {
    lastEdited = 'pay';
    const payAmount = parseFloat(document.getElementById('payAmountInput').value);
    const currency = document.getElementById('currencySelect').value;
    const mcfInput = document.getElementById('mcfAmountInput');

    if (isNaN(payAmount) || payAmount <= 0) {
        mcfInput.value = "";
        return;
    }

    const mcfAmount = payAmount * RATES[currency];
    mcfInput.value = mcfAmount;
}

    // Ввод в нижнем поле -> рассчитываем сумму оплаты
    function calculatePayAmount() {
    lastEdited = 'mcf';
    const mcfAmount = parseFloat(document.getElementById('mcfAmountInput').value);
    const currency = document.getElementById('currencySelect').value;
    const payInput = document.getElementById('payAmountInput');

    if (isNaN(mcfAmount) || mcfAmount <= 0) {
        payInput.value = "";
        return;
    }

    const payAmount = mcfAmount / RATES[currency];
    
    // Для ETH выводим больше знаков после запятой, для stablecoin — 2
    if (currency === 'ETH') {
        payInput.value = payAmount.toFixed(6);
    } else {
        payInput.value = payAmount.toFixed(2);
    }
}

    // Смена монеты (USDC / USDT / ETH) -> пересчет относительно последнего измененного поля
    function onCurrencyChange() {
    if (lastEdited === 'mcf') {
        calculatePayAmount();
    } else {
        calculateMCF();
    }
}

    
        function showModal(title, text) {
            document.getElementById('modalTitle').innerText = title;
            document.getElementById('modalText').innerText = text;
            document.getElementById('customModal').classList.add('show');
        }

        function closeModal() {
            document.getElementById('customModal').classList.remove('show');
        }

        function closeModalOnOutside(event) {
            document.getElementById('customModal').classList.remove('show');
        }

        function handleWalletClick() {
            if (!isConnected) {
                connectWallet();
            } else {
                document.getElementById('walletDropdown').classList.toggle('show');
            }
        }

        window.addEventListener('click', function(e) {
            const wrapper = document.querySelector('.wallet-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('walletDropdown').classList.remove('show');
            }
        });

        async function connectWallet() {
            if (window.ethereum) {
                try {
                    provider = new ethers.BrowserProvider(window.ethereum);
                    const accounts = await provider.send("eth_requestAccounts", []);
                    userAddress = accounts[0];

                    const network = await provider.getNetwork();
                    if (network.chainId !== 8453n) {
                        try {
                            await window.ethereum.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: BASE_CHAIN_ID }],
                            });
                            provider = new ethers.BrowserProvider(window.ethereum);
                        } catch (err) {
                            showModal("Ошибка сети", "Пожалуйста, переключите сеть в кошельке на Base Mainnet!");
                            return;
                        }
                    }

                    signer = await provider.getSigner();
                    isConnected = true;

                    const btn = document.getElementById('connectWalletBtn');
                    const shortAddr = userAddress.substring(0, 6) + '...' + userAddress.substring(userAddress.length - 4);
                    btn.innerText = shortAddr;
                    btn.classList.add('btn-success');

                    document.getElementById('explorerLink').href = `https://basescan.org/address/${userAddress}`;

                    const badge = document.getElementById('networkBadge');
                    badge.innerText = "Base Network";
                    badge.style.color = "var(--success)";
                    badge.style.borderColor = "rgba(16, 185, 129, 0.2)";
                    badge.style.background = "rgba(16, 185, 129, 0.1)";

                    await updateBalances();

                } catch (error) {
                    console.error("Ошибка подключения:", error);
                }
            } else {
                showModal("Ошибка", "Установите Rabby Wallet или MetaMask!");
            }
        }

        function copyAddress() {
            if (!userAddress) return;
            navigator.clipboard.writeText(userAddress).then(() => {
                showModal("Успешно", "Адрес кошелька скопирован в буфер обмена!");
                document.getElementById('walletDropdown').classList.remove('show');
            });
        }

        function disconnectWallet() {
            userAddress = null;
            signer = null;
            isConnected = false;

            const btn = document.getElementById('connectWalletBtn');
            btn.innerText = "Подключить кошелек";
            btn.classList.remove('btn-success');

            document.getElementById('walletDropdown').classList.remove('show');

            const badge = document.getElementById('networkBadge');
            badge.innerText = "Не подключено";
            badge.style.color = "";
            badge.style.borderColor = "";
            badge.style.background = "";

            document.getElementById('ethBalance').innerText = "0.00";
            document.getElementById('usdtBalance').innerText = "0.00";
            document.getElementById('usdcBalance').innerText = "0.00";
            document.getElementById('mcfBalance').innerText = "0.00";
        }

        async function updateBalances() {
            if (!userAddress || !provider) return;
            try {
                const ethWei = await provider.getBalance(userAddress);
                document.getElementById('ethBalance').innerText = parseFloat(ethers.formatEther(ethWei)).toFixed(4);

                try {
                    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
                    const usdcBal = await usdcContract.balanceOf(userAddress);
                    document.getElementById('usdcBalance').innerText = parseFloat(ethers.formatUnits(usdcBal, 6)).toFixed(2);
                } catch (e) { console.error("Ошибка USDC:", e); }

                try {
                    const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
                    const usdtBal = await usdtContract.balanceOf(userAddress);
                    document.getElementById('usdtBalance').innerText = parseFloat(ethers.formatUnits(usdtBal, 6)).toFixed(2);
                } catch (e) { console.error("Ошибка USDT:", e); }

                try {
                    const mcfContract = new ethers.Contract(MCF_TOKEN_ADDRESS, ERC20_ABI, provider);
                    const mcfBal = await mcfContract.balanceOf(userAddress);
                    const formattedMcf = ethers.formatUnits(mcfBal, 18);
                    document.getElementById('mcfBalance').innerText = Number(formattedMcf).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
                } catch (e) {
                    document.getElementById('mcfBalance').innerText = "0.00";
                }

            } catch (err) {
                console.error("Ошибка загрузки балансов:", err);
            }
        }

        async function buyTokens() {
            if (!isConnected) {
                await connectWallet();
                if (!isConnected) return;
            }

            const rawAmount = document.getElementById('payAmountInput').value;
            const amount = parseFloat(rawAmount);
            const currency = document.getElementById('currencySelect').value;

            if (isNaN(amount) || amount <= 0) {
                showModal("Ошибка ввода", "Укажите корректную сумму для покупки!");
                return;
            }

            const buyBtn = document.getElementById('buyBtn');
            const presaleContract = new ethers.Contract(PRESALE_ADDRESS, PRESALE_ABI, signer);

            try {
                buyBtn.disabled = true;

                if (currency === "ETH") {
                    buyBtn.innerText = "Подтвердите в кошельке...";
                    const parsedWei = ethers.parseEther(rawAmount);

                    const tx = await presaleContract.buyWithETH({ value: parsedWei });
                    buyBtn.innerText = "Обработка...";
                    showModal("Транзакция отправлена", `Ожидаем подтверждения...\nHash: ${tx.hash}`);

                    await tx.wait();
                    showModal("Успешно!", `Вы приобрели MCF за ETH!\nХэш: ${tx.hash}`);

                } else {
                    const tokenAddress = (currency === "USDC") ? USDC_ADDRESS : USDT_ADDRESS;
                    const parsedUnits = ethers.parseUnits(rawAmount, 6);
                    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

                    const allowance = await tokenContract.allowance(userAddress, PRESALE_ADDRESS);

                    if (allowance < parsedUnits) {
                        buyBtn.innerText = `Разрешение (${currency})...`;
                        showModal("Шаг 1 из 2", `Подтвердите разрешение на использование ${currency} в кошельке.`);

                        const approveTx = await tokenContract.approve(PRESALE_ADDRESS, parsedUnits);
                        buyBtn.innerText = "Обработка разрешения...";
                        await approveTx.wait();
                    }

                    buyBtn.innerText = "Подтверждение покупки...";
                    let tx;
                    if (currency === "USDC") {
                        tx = await presaleContract.buyWithUSDC(parsedUnits);
                    } else {
                        tx = await presaleContract.buyWithUSDT(parsedUnits);
                    }

                    buyBtn.innerText = "Обработка...";
                    showModal("Транзакция отправлена", `Ожидаем подтверждения...\nHash: ${tx.hash}`);

                    await tx.wait();
                    showModal("Поздравляем!", `Вы приобрели MCF за ${currency}!\nХэш: ${tx.hash}`);
                }

                document.getElementById('payAmountInput').value = "";
                document.getElementById('mcfAmountInput').value = "0.0";
                await updateBalances();

            } catch (err) {
                console.error("Ошибка при покупке:", err);
                let message = err.reason || err.message || "Транзакция отменена или произошла ошибка.";
                if (err.code === "ACTION_REJECTED") {
                    message = "Пользователь отменил транзакцию в кошельке.";
                }
                showModal("Ошибка транзакции", message);
            } finally {
                buyBtn.disabled = false;
                buyBtn.innerText = "Купить MCF Токены";
            }
        }


        function openAboutModal() {
          document.getElementById('aboutModal').classList.add('show');
        }

        function closeAboutModal() {
            document.getElementById('aboutModal').classList.remove('show');
        }

        function closeAboutModalOnOutside(event) {
            if (event.target.id === 'aboutModal') {
                closeAboutModal();
            }
        }