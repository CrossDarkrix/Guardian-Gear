import {
    world,
    system,
    EquipmentSlot,
    InputButton,
    ButtonState
} from "@minecraft/server";

let tick = 0;

/*
    Armor IDs
*/
const HELMET_ID = "guardian-gear:guardian_helmet";
const CHEST_ID = "guardian-gear:barrier_chestplate";
const LEGS_ID = "guardian-gear:soulguard_leggings";
const BOOTS_ID = "guardian-gear:rescue_boots";

const RESCUE_GLASS_ID = "minecraft:lime_stained_glass";

/*
    Utility
*/
function getEquipment(player) {
    return player.getComponent("equippable");
}

function getFeet(player) {
    return getEquipment(player)?.getEquipment(EquipmentSlot.Feet);
}

function getLegs(player) {
    return getEquipment(player)?.getEquipment(EquipmentSlot.Legs);
}

function getChest(player) {
    return getEquipment(player)?.getEquipment(EquipmentSlot.Chest);
}

function getHead(player) {
    return getEquipment(player)?.getEquipment(EquipmentSlot.Head);
}

function hasFullSet(player) {
    const eq = getEquipment(player);

    if (!eq) return false;

    return (
        eq.getEquipment(EquipmentSlot.Head)?.typeId === HELMET_ID &&
        eq.getEquipment(EquipmentSlot.Chest)?.typeId === CHEST_ID &&
        eq.getEquipment(EquipmentSlot.Legs)?.typeId === LEGS_ID &&
        eq.getEquipment(EquipmentSlot.Feet)?.typeId === BOOTS_ID
    );
}

/*
    Helmet
*/
function handleHelmet(player) {
    const head = getHead(player);
    const dimension = player.dimension;
    const pos = player.location;
    const time = world.getTimeOfDay();

    const light = dimension.getLightLevel({
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z)
    });
    const skyLight = dimension.getSkyLightLevel({
        x: Math.floor(pos.x),
        y: Math.floor(pos.y),
        z: Math.floor(pos.z)
    });
    const isNight = time >= 13000 && time <= 23000;
    const isDark = light <= 7 || skyLight <= 4;
	const isUnderGround = player.location.y < 50;
    if (head?.typeId !== HELMET_ID)
        return;

    try {
        if (player.isInWater) {
            if (tick % 25 === 0) {
                player.addEffect("conduit_power", 500, {
                    amplifier: 0,
                    showParticles: false
                });
            }
        }

        if (tick % 25 === 0) {
            if (isNight || (isUnderGround && isDark)) {
                player.addEffect("night_vision", 500, {
                    amplifier: 0,
                    showParticles: false
                });
            }
        }
    } catch {}
}

/*
    Leggings
*/
function handleLeggings(player) {
    const legs = getLegs(player);

    if (legs?.typeId !== LEGS_ID)
        return;

    try {
        if (player.getEffect("wither")) {
            player.removeEffect("wither");
            try {
                for (let i = 0; i < 5; i++) {
                    player.dimension.spawnParticle(
                        "minecraft:soul_particle",
                        {
                            x: player.location.x +
                                (Math.random() - 0.5) * 0.5,
                            y: player.location.y + 1,
                            z: player.location.z +
                                (Math.random() - 0.5) * 0.5
                        }
                    );
                }
            } catch {}
        }
    } catch {}

    try {
        const x = Math.floor(player.location.x);
        const y = Math.floor(player.location.y - 1);
        const z = Math.floor(player.location.z);

        const block = player.dimension.getBlock({ x, y, z });

        if (
            block &&
            (
                block.typeId === "minecraft:soul_sand" ||
                block.typeId === "minecraft:soul_soil"
            )
        ) {
            player.addEffect("speed", 120, {
                amplifier: 2,
                showParticles: false
            });
            if (tick % 20 === 0) {
                try {
                    player.dimension.spawnParticle(
                        "minecraft:soul_particle",
                        {
                            x: player.location.x,
                            y: player.location.y + 0.1,
                            z: player.location.z
                        }
                    );
                } catch {}
            }
        }
    } catch {}
}

/*
    Boots
*/
function handleBoots(player) {
    const feet = getFeet(player);

    if (feet?.typeId !== BOOTS_ID)
        return;

    const jump =
        player.inputInfo.getButtonState(InputButton.Jump) ===
        ButtonState.Pressed;

    const vel = player.getVelocity();

    if (player.isOnGround) {
        player.setDynamicProperty("rescue_was_grounded", true);
        return;
    }

    const wasGrounded =
        player.getDynamicProperty("rescue_was_grounded") === true;

    if (!wasGrounded)
        return;

    if (jump)
        return;

    if (vel.y > -0.05)
        return;

    if (!player.isOnGround && !jump && vel.y < -0.1) {
        placeRescueGlass(player);
        player.setDynamicProperty("rescue_was_grounded", false);
    }
}

function placeRescueGlass(player) {
    const dir = player.getViewDirection();
    let fx = 0;
    let fz = 0;
    if (Math.abs(dir.x) > Math.abs(dir.z)) {
        fx = Math.sign(dir.x);
    } else {
        fz = Math.sign(dir.z);
    }

    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y - 1);
    const pz = Math.floor(player.location.z);

    const positions = [
        { x: px, y: py, z: pz },
        { x: px + fx, y: py, z: pz + fz },
        { x: px - fx, y: py, z: pz - fz }
    ];

    for (const pos of positions) {
        try {
            const block = player.dimension.getBlock(pos);

            if (!block)
                continue;

            if (
                block.typeId !== "minecraft:air" &&
                block.typeId !== "minecraft:cave_air" &&
                block.typeId !== "minecraft:void_air"
                )
                continue;

            block.setType(RESCUE_GLASS_ID);
            try {
                player.dimension.spawnParticle(
                    "minecraft:endrod",
                    {
                        x: pos.x + 0.5,
                        y: pos.y + 0.5,
                        z: pos.z + 0.5
                    }
                );
            } catch {}
            system.runTimeout(() => {
                try {
                    const current =
                        player.dimension.getBlock(pos);

                    if (
                        current &&
                        current.typeId === RESCUE_GLASS_ID
                    ) {
                        current.setType("minecraft:air");
                    }
                } catch {}
            }, 80);
        } catch {}
    }
}

/*
    Full Set Bonus
*/
function handleSetBonus(player) {
    if (!hasFullSet(player))
        return;
    if (tick % 100 === 0) {
        try {
            player.dimension.spawnParticle(
                "minecraft:totem_particle",
                {
                    x: player.location.x,
                    y: player.location.y + 1,
                    z: player.location.z
                }
            );
        } catch {}
    }
    try {
        player.addEffect("resistance", 40, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

/*
    Fire Barrier Update
*/
function handleFireBarrier(player) {
    const expire =
        Number(player.getDynamicProperty("fire_barrier_until")) || 0;

    if (expire <= tick)
        return;

    try {
        player.addEffect("fire_resistance", 40, {
            amplifier: 0,
            showParticles: false
        });
    } catch {}
}

/*
    Main Tick
*/
system.runInterval(() => {
    tick++;

    for (const player of world.getPlayers()) {
        handleHelmet(player);
        handleLeggings(player);
        handleBoots(player);
        handleSetBonus(player);
        handleFireBarrier(player);
    }
}, 1);

/*
    Damage Events
*/
world.beforeEvents.entityHurt.subscribe((event) => {
    const player = event.hurtEntity;

    if (player.typeId !== "minecraft:player")
        return;

    const eq = player.getComponent("equippable");

    if (!eq)
        return;

    const head = eq.getEquipment(EquipmentSlot.Head);
    const chest = eq.getEquipment(EquipmentSlot.Chest);
    const legs = eq.getEquipment(EquipmentSlot.Legs);
    const feet = eq.getEquipment(EquipmentSlot.Feet);

    /*
        Boots
    */
    if (
        feet?.typeId === BOOTS_ID &&
        event.damageSource.cause === "fall"
    ) {
        event.cancel = true;
    }

    /*
        Chestplate Projectile Shield
    */
    if (
        chest?.typeId === CHEST_ID &&
        event.damageSource.cause === "projectile"
    ) {
        event.cancel = true;
        try {
            player.dimension.playSound("random.anvil_land", {
                        x: player.location.x,
                        y: player.location.y,
                        z: player.location.z
            });
        } catch {}
        try {
            for (let i = 0; i < 8; i++) {
                player.dimension.spawnParticle(
                    "minecraft:trial_spawner_detection",
                    {
                        x: player.location.x + (Math.random() - 0.5) * 0.6,
                        y: player.location.y + 1.0,
                        z: player.location.z + (Math.random() - 0.5) * 0.6
                    }
                );
            }
        } catch {}
        return;
    }

    /*
        Chestplate Fire Trigger
    */
    if (chest?.typeId === CHEST_ID) {
        const cause = event.damageSource.cause;

        if (
            cause === "fire" ||
            cause === "lava" ||
            cause === "fireTick"
        ) {
            try {
                for (let i = 0; i < 10; i++) {
                    player.dimension.spawnParticle(
                        "minecraft:totem_particle",
                        {
                            x: player.location.x +
                                (Math.random() - 0.5),
                            y: player.location.y + 1,
                            z: player.location.z +
                                (Math.random() - 0.5)
                        }
                    );
                }
            } catch {}
            player.setDynamicProperty(
                "fire_barrier_until",
                tick + 200
            );

            event.cancel = true;
            return;
        }

        const fireBarrierUntil =
            Number(
                player.getDynamicProperty("fire_barrier_until")
            ) || 0;

        if (tick < fireBarrierUntil) {
            event.cancel = true;
            return;
        }
    }

    /*
        Leggings Protection
    */
    if (legs?.typeId === LEGS_ID) {
        const attacker = event.damageSource.damagingEntity;
        if (
            attacker?.typeId === "minecraft:wither" ||
            attacker?.typeId === "minecraft:wither_skeleton"
        ) {
            event.cancel = true;

            try {
                for (let i = 0; i < 8; i++) {
                    player.dimension.spawnParticle(
                        "minecraft:trial_spawner_detection",
                        {
                            x: player.location.x +
                                (Math.random() - 0.5) * 0.6,
                            y: player.location.y + 1,
                            z: player.location.z +
                                (Math.random() - 0.5) * 0.6
                        }
                    );
                }
            } catch {}
        }
    }
});
