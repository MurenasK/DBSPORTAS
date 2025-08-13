import React from 'react';
import { Svg, Text, Path } from 'react-native-svg';

const DBSportLogo = () => (
  <Svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 64" width="60" height="64">
    <Text
      fill="#108040"
      textAnchor="middle"
      x="40"
      y="50"
      fontFamily="tahoma"
      fontSize="64"
      fontWeight="bold"
      transform="scale(0.75,1)"
    >
      db
    </Text>
    <Text
      fill="#C0E090"
      textAnchor="middle"
      x="30"
      y="64"
      fontFamily="tahoma"
      fontSize="16"
      fontWeight="bold"
    >
      SPORT
    </Text>
    <Path d="M59,25 h-26 v26 h26 z" fill="#ff671f" stroke="#ff671f" />
    <Path d="M57,26 h-23 v23 z" fill="white" stroke="white" />
  </Svg>
);

export default DBSportLogo;