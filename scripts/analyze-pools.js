// Комплексный анализ Pool контрактов Neovalend Protocol
// Проверяет состояние всех известных Pool адресов
const { execSync } = require('child_process');

// RPC endpoint
const RPC = process.env.RPC_URL_SEPOLIA || 'https://sepolia.infura.io/v3/746e6062f3664276add2f792620b3a76';

// Адрес пользователя для проверки
const USER = '0x1a4bFAEc349BaCDfda25b209df534697D8a114aD';

// Известные Pool адреса (из истории)
const POOLS = {
  OLD: '0xd272575622c700c44a1769ebd1a3dbfa74f2ae55',  // Из deployments.json
  CURRENT: '0x0cde208D79D723B51aFaff0683d6dE2878304Ba5'  // Из .env.local и contracts.ts
};

// Резервы для проверки
const RESERVES = {
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  wA7A5: '0x18fb744Eb960480179006E3391293c77bB6f8De6',
  WBTC: '0x29f2D40B0605204364af54EC677bD022dA425d03'
};

console.log('🔍 КОМПЛЕКСНЫЙ АНАЛИЗ POOL КОНТРАКТОВ\n');
console.log('=' .repeat(80));
console.log(`👤 Пользователь: ${USER}`);
console.log(`🌐 RPC: ${RPC}`);
console.log('=' .repeat(80) + '\n');

function execCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    return `ERROR: ${error.message}`;
  }
}

function checkPoolExists(poolAddress) {
  console.log(`\n📍 Проверка Pool: ${poolAddress}`);
  console.log('-'.repeat(80));

  // Проверка 1: Есть ли код по адресу?
  const code = execCommand(`cast code ${poolAddress} --rpc-url ${RPC}`);
  const hasCode = code && code !== '0x' && !code.includes('ERROR');

  console.log(`   Код контракта: ${hasCode ? '✅ Найден' : '❌ Отсутствует'}`);

  if (!hasCode) {
    console.log(`   ⚠️  Контракт не задеплоен или не является proxy`);
    return { exists: false };
  }

  return { exists: true };
}

function checkUserAccountData(poolAddress) {
  console.log(`\n   📊 getUserAccountData()`);

  try {
    const data = execCommand(
      `cast call ${poolAddress} "getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)" ${USER} --rpc-url ${RPC}`
    );

    if (data.includes('ERROR') || data.includes('call to')) {
      console.log(`      ❌ Ошибка: ${data}`);
      return null;
    }

    // Парсим результат (6 uint256 значений)
    const values = data.match(/\d+/g);
    if (!values || values.length < 6) {
      console.log(`      ❌ Неверный формат данных`);
      return null;
    }

    const [totalCollateral, totalDebt, availableBorrow, currentLiquidationThreshold, ltv, healthFactor] = values;

    console.log(`      Total Collateral: ${totalCollateral} (${(parseInt(totalCollateral) / 1e8).toFixed(2)} USD)`);
    console.log(`      Total Debt: ${totalDebt} (${(parseInt(totalDebt) / 1e8).toFixed(2)} USD)`);
    console.log(`      Available Borrow: ${availableBorrow} (${(parseInt(availableBorrow) / 1e8).toFixed(2)} USD)`);
    console.log(`      Liquidation Threshold: ${currentLiquidationThreshold} bps`);
    console.log(`      LTV: ${ltv} bps`);
    console.log(`      Health Factor: ${healthFactor}`);

    const hasPositions = parseInt(totalCollateral) > 0 || parseInt(totalDebt) > 0;
    console.log(`      ${hasPositions ? '✅ ЕСТЬ АКТИВНЫЕ ПОЗИЦИИ' : '⚠️  Нет активных позиций'}`);

    return {
      totalCollateral: parseInt(totalCollateral),
      totalDebt: parseInt(totalDebt),
      availableBorrow: parseInt(availableBorrow),
      hasPositions
    };
  } catch (error) {
    console.log(`      ❌ Ошибка вызова: ${error.message}`);
    return null;
  }
}

function checkUserConfiguration(poolAddress) {
  console.log(`\n   🔧 getUserConfiguration()`);

  try {
    const config = execCommand(
      `cast call ${poolAddress} "getUserConfiguration(address)(uint256)" ${USER} --rpc-url ${RPC}`
    );

    if (config.includes('ERROR')) {
      console.log(`      ❌ Ошибка: ${config}`);
      return null;
    }

    const configValue = BigInt(config);
    console.log(`      Configuration Bitmap: ${config}`);

    // Декодируем bitmap для первых 3 резервов
    const usesReserves = [];
    for (let i = 0; i < 3; i++) {
      const isCollateral = (configValue >> BigInt(i * 2)) & BigInt(1);
      const isBorrowing = (configValue >> BigInt(i * 2 + 1)) & BigInt(1);

      if (isCollateral || isBorrowing) {
        usesReserves.push({
          index: i,
          isCollateral: isCollateral === BigInt(1),
          isBorrowing: isBorrowing === BigInt(1)
        });
      }
    }

    if (usesReserves.length > 0) {
      console.log(`      ✅ Используемые резервы:`);
      usesReserves.forEach(r => {
        console.log(`         Reserve ${r.index}: ${r.isCollateral ? 'Collateral ' : ''}${r.isBorrowing ? 'Borrowing' : ''}`);
      });
    } else {
      console.log(`      ⚠️  Не использует ни один резерв`);
    }

    return usesReserves;
  } catch (error) {
    console.log(`      ❌ Ошибка вызова: ${error.message}`);
    return null;
  }
}

function checkReservesList(poolAddress) {
  console.log(`\n   📋 getReservesList()`);

  try {
    const reserves = execCommand(
      `cast call ${poolAddress} "getReservesList()(address[])" --rpc-url ${RPC}`
    );

    if (reserves.includes('ERROR')) {
      console.log(`      ❌ Ошибка: ${reserves}`);
      return [];
    }

    // Парсим адреса из вывода
    const addresses = reserves.match(/0x[a-fA-F0-9]{40}/g) || [];

    if (addresses.length > 0) {
      console.log(`      ✅ Инициализировано резервов: ${addresses.length}`);
      addresses.forEach((addr, i) => {
        // Проверим известные адреса
        const name = Object.entries(RESERVES).find(([_, val]) => val.toLowerCase() === addr.toLowerCase())?.[0] || 'Unknown';
        console.log(`         [${i}] ${addr} (${name})`);
      });
    } else {
      console.log(`      ⚠️  Нет инициализированных резервов`);
    }

    return addresses;
  } catch (error) {
    console.log(`      ❌ Ошибка вызова: ${error.message}`);
    return [];
  }
}

function checkReserveData(poolAddress, reserveAddress, name) {
  console.log(`\n   💰 getReserveData(${name})`);

  try {
    const data = execCommand(
      `cast call ${poolAddress} "getReserveData(address)" ${reserveAddress} --rpc-url ${RPC}`
    );

    if (data.includes('ERROR')) {
      console.log(`      ❌ Ошибка: ${data}`);
      return null;
    }

    // Пытаемся найти aToken address в данных
    const aTokenMatch = data.match(/0x[a-fA-F0-9]{40}/g);
    if (aTokenMatch && aTokenMatch.length > 0) {
      const aTokenAddress = aTokenMatch[0]; // Обычно первый адрес это aToken
      console.log(`      aToken: ${aTokenAddress}`);

      // Проверим баланс пользователя
      try {
        const balance = execCommand(
          `cast call ${aTokenAddress} "balanceOf(address)(uint256)" ${USER} --rpc-url ${RPC}`
        );

        if (!balance.includes('ERROR')) {
          const balanceValue = BigInt(balance);
          console.log(`      Баланс aToken: ${balance} (${balanceValue > 0n ? '✅ ЕСТЬ ДЕПОЗИТ' : 'нет депозита'})`);
          return { aToken: aTokenAddress, balance: balance };
        }
      } catch (e) {
        console.log(`      ⚠️  Не удалось проверить баланс aToken`);
      }
    }

    console.log(`      ✅ Резерв инициализирован`);
    return { initialized: true };
  } catch (error) {
    console.log(`      ❌ Ошибка вызова: ${error.message}`);
    return null;
  }
}

// ===== MAIN ANALYSIS =====
console.log('🎯 НАЧАЛО АНАЛИЗА\n');

const results = {};

for (const [name, poolAddress] of Object.entries(POOLS)) {
  console.log('\n' + '='.repeat(80));
  console.log(`🏊 POOL: ${name}`);
  console.log('='.repeat(80));

  const poolCheck = checkPoolExists(poolAddress);

  if (!poolCheck.exists) {
    results[name] = { exists: false };
    continue;
  }

  // Проверяем getUserAccountData
  const accountData = checkUserAccountData(poolAddress);

  // Проверяем getUserConfiguration
  const userConfig = checkUserConfiguration(poolAddress);

  // Проверяем getReservesList
  const reservesList = checkReservesList(poolAddress);

  // Проверяем данные по каждому известному резерву
  for (const [reserveName, reserveAddress] of Object.entries(RESERVES)) {
    checkReserveData(poolAddress, reserveAddress, reserveName);
  }

  results[name] = {
    exists: true,
    accountData,
    userConfig,
    reservesList,
    hasUserPositions: accountData?.hasPositions || false
  };
}

// ===== SUMMARY =====
console.log('\n\n' + '='.repeat(80));
console.log('📊 СВОДНАЯ ТАБЛИЦА РЕЗУЛЬТАТОВ');
console.log('='.repeat(80));

console.log('\n┌─────────────┬─────────┬──────────────┬───────────┬────────────┐');
console.log('│ Pool        │ Exists  │ User Positions│ Reserves  │ Status     │');
console.log('├─────────────┼─────────┼──────────────┼───────────┼────────────┤');

for (const [name, result] of Object.entries(results)) {
  const exists = result.exists ? '✅ Yes' : '❌ No ';
  const positions = result.hasUserPositions ? '✅ Yes' : '⚠️  No ';
  const reserves = result.reservesList?.length || 0;
  const status = result.hasUserPositions ? '🟢 ACTIVE' : result.exists ? '🟡 EMPTY' : '🔴 MISSING';

  console.log(`│ ${name.padEnd(11)} │ ${exists}  │ ${positions}         │ ${reserves.toString().padStart(9)} │ ${status}    │`);
}

console.log('└─────────────┴─────────┴──────────────┴───────────┴────────────┘');

// ===== РЕКОМЕНДАЦИИ =====
console.log('\n\n' + '='.repeat(80));
console.log('💡 РЕКОМЕНДАЦИИ');
console.log('='.repeat(80));

const hasOldPositions = results.OLD?.hasUserPositions;
const hasCurrentPositions = results.CURRENT?.hasUserPositions;

if (hasOldPositions && !hasCurrentPositions) {
  console.log('\n⚠️  ОБНАРУЖЕНЫ ПОЗИЦИИ ТОЛЬКО В OLD POOL!');
  console.log('   Причина: Frontend обновлен на CURRENT Pool, но депозиты/займы остались в OLD');
  console.log('   Решение:');
  console.log('   1. Для новых операций - используйте CURRENT Pool (0x0cde...)');
  console.log('   2. Для OLD позиций - нужна миграция:');
  console.log('      a) Вывести средства из OLD Pool через специальный UI/скрипт');
  console.log('      b) Депозитировать в CURRENT Pool');
  console.log('   3. ИЛИ временно вернуть OLD Pool в Frontend для закрытия позиций');
} else if (!hasOldPositions && hasCurrentPositions) {
  console.log('\n✅ ВСЕ ПОЗИЦИИ В CURRENT POOL!');
  console.log('   Статус: Протокол работает корректно');
  console.log('   Действия: Продолжайте использовать CURRENT Pool');
} else if (hasOldPositions && hasCurrentPositions) {
  console.log('\n⚠️  ПОЗИЦИИ НАЙДЕНЫ В ОБОИХ POOL!');
  console.log('   Причина: Пользователь использовал оба Pool в разное время');
  console.log('   Рекомендация: Консолидировать все средства в CURRENT Pool');
  console.log('   Шаги:');
  console.log('   1. Закрыть позиции в OLD Pool');
  console.log('   2. Перевести средства в CURRENT Pool');
  console.log('   3. Удалить OLD Pool из конфигурации');
} else {
  console.log('\n✅ НЕТ АКТИВНЫХ ПОЗИЦИЙ');
  console.log('   Статус: Пользователь может начать работу с протоколом');
  console.log('   Рекомендация: Используйте CURRENT Pool (0x0cde...)');
}

console.log('\n' + '='.repeat(80));
console.log('✅ АНАЛИЗ ЗАВЕРШЕН');
console.log('='.repeat(80) + '\n');
